const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const config = require('./config');
const logger = require('./utils/logger');
const { validateSession } = require('./auth/sessionValidator');
const connectionManager = require('./connections/manager');
const { startHeartbeat } = require('./connections/heartbeat');
const { validateEvent } = require('./events/eventBuilder');
const { broadcast } = require('./events/broadcaster');
const { analyzeEvent } = require('./anomaly/client');
const healthMonitor = require('./anomaly/healthMonitor');
const deduplicator = require('./anomaly/deduplicator');
const { EventQueue } = require('./queue/eventQueue');

// Bounded event queue for when anomaly engine is unavailable
const eventQueue = new EventQueue(500);
const { createSSEHandler, broadcastSSE, getSSEClientCount } = require('./fallback/sseHandler');

const app = express();
app.use(express.json());

// Health check endpoint for the WebSocket server itself
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// SSE fallback endpoint for clients that cannot establish WebSocket connections
app.get('/events/stream', createSSEHandler());

// Internal event endpoint — called by PHP scan.php to broadcast attendance events
app.post('/internal/event', (req, res) => {
  const validation = validateEvent(req.body);
  if (!validation.valid) {
    logger.warn('Invalid event payload received', { error: validation.error });
    return res.status(400).json({ error: validation.error });
  }

  // Broadcast attendance event to all connected clients
  broadcast('attendance_event', validation.event);

  // Also broadcast to SSE fallback clients
  broadcastSSE('attendance_event', validation.event);

  logger.info('Attendance event broadcast', {
    studentId: validation.event.student_id,
    action: validation.event.action,
  });

  // Trigger anomaly analysis (async, non-blocking to the HTTP response)
  processAnomalyAnalysis(validation.event);

  res.status(200).json({ delivered: true });
});

/**
 * Process anomaly analysis for an attendance event.
 * Respects circuit breaker state — queues events when engine is unavailable.
 */
async function processAnomalyAnalysis(event) {
  if (!healthMonitor.isAvailable()) {
    // Circuit open — queue the event for later processing
    eventQueue.enqueue(event);
    logger.debug('Event queued (circuit open)', {
      studentId: event.student_id,
      queueSize: eventQueue.size(),
    });
    return;
  }

  const result = await analyzeEvent(event);

  if (!result) {
    // Analysis failed — notify health monitor
    healthMonitor.onAnalysisFailure();
    return;
  }

  // Analysis succeeded — notify health monitor (for halfOpen → closed transition)
  healthMonitor.onAnalysisSuccess();

  // Process returned alerts
  if (result.alerts && result.alerts.length > 0) {
    for (const alert of result.alerts) {
      if (deduplicator.shouldBroadcast(alert)) {
        broadcast('anomaly_alert', alert);
        broadcastSSE('anomaly_alert', alert);
        logger.info('Anomaly alert broadcast', {
          studentId: alert.student_id,
          patternType: alert.pattern_type,
          score: alert.score,
        });
      } else {
        logger.debug('Anomaly alert suppressed (duplicate within 24h)', {
          studentId: alert.student_id,
          patternType: alert.pattern_type,
        });
      }
    }
  }

  // If circuit just closed and there are queued events, process them
  if (healthMonitor.state === 'closed' && !eventQueue.isEmpty()) {
    const queuedEvents = eventQueue.dequeueAll();
    logger.info('Processing queued events after recovery', { count: queuedEvents.length });
    for (const queuedEvent of queuedEvents) {
      // Process each queued event but don't re-queue on failure
      const queuedResult = await analyzeEvent(queuedEvent);
      if (queuedResult && queuedResult.alerts) {
        for (const alert of queuedResult.alerts) {
          if (deduplicator.shouldBroadcast(alert)) {
            broadcast('anomaly_alert', alert);
            broadcastSSE('anomaly_alert', alert);
          }
        }
      }
    }
  }
}

const server = http.createServer(app);

const wss = new WebSocketServer({ noServer: true });

// Handle HTTP upgrade requests manually for auth + origin validation
server.on('upgrade', async (req, socket, head) => {
  const origin = req.headers.origin;

  // 1. Validate origin
  if (!connectionManager.validateOrigin(origin)) {
    logger.warn('Connection rejected: invalid origin', { origin, ip: req.socket.remoteAddress });
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }

  // 2. Extract session token from URL query string (ws://host:3001?token=xxx)
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token) {
    logger.warn('Connection rejected: missing token', { ip: req.socket.remoteAddress });
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  // 3. Validate token via PHP session validator
  const sessionResult = await validateSession(token);

  if (!sessionResult.valid) {
    logger.warn('Connection rejected: invalid session token', {
      ip: req.socket.remoteAddress,
      token: token.substring(0, 8) + '...',
    });
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  // 4. Upgrade the connection
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req, {
      sessionId: token,
      adminId: sessionResult.admin_id,
      adminName: sessionResult.admin_name,
    });
  });
});

wss.on('connection', (ws, req, sessionData) => {
  const { sessionId, adminId, adminName } = sessionData;

  logger.info('New WebSocket connection authenticated', {
    ip: req.socket.remoteAddress,
    adminId,
    adminName,
  });

  // Add to connection manager
  connectionManager.addClient(sessionId, ws, adminId, adminName);

  ws.on('close', (code, reason) => {
    logger.info('WebSocket connection closed', {
      code,
      reason: reason ? reason.toString() : '',
      adminId,
    });
    connectionManager.removeClient(sessionId);
  });

  ws.on('error', (err) => {
    logger.error('WebSocket error', { error: err.message, adminId });
    connectionManager.removeClient(sessionId);
  });
});

server.listen(config.port, () => {
  logger.info(`WebSocket server started`, {
    port: config.port,
    allowedOrigins: config.allowedOrigins,
    anomalyEngineUrl: config.anomalyEngineUrl,
  });

  // Start periodic session re-validation heartbeat
  startHeartbeat();

  // Start anomaly engine health monitoring with circuit breaker
  healthMonitor.start();
});

module.exports = { app, server, wss, connectionManager, broadcastSSE, getSSEClientCount, healthMonitor, eventQueue, deduplicator, processAnomalyAnalysis };
