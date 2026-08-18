const { validateSession } = require('../auth/sessionValidator');
const logger = require('../utils/logger');
const config = require('../config');

// Track SSE clients for broadcasting
const sseClients = new Map(); // token -> response

/**
 * Creates an Express route handler for SSE fallback connections.
 * GET /events/stream?token=xxx
 *
 * Validates the session token, sets SSE headers, and keeps the connection
 * open for server-push of attendance_event and anomaly_alert messages.
 */
function createSSEHandler() {
  return async (req, res) => {
    // Set CORS headers first — must be present on every response including errors
    const origin = req.headers.origin;
    if (origin && config.allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      return res.status(200).end();
    }

    // 1. Extract token from query string: /events/stream?token=xxx
    const token = req.query.token;
    if (!token) {
      return res.status(401).json({ error: 'Missing session token' });
    }

    // 2. Validate session
    const session = await validateSession(token);
    if (!session.valid) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    // 3. Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.status(200).flushHeaders();

    // 4. Send initial connection event
    res.write('data: {"type":"connected"}\n\n');

    // 5. Track client
    sseClients.set(token, res);

    logger.info('SSE client connected', { adminId: session.admin_id });

    // 6. Handle client disconnect
    req.on('close', () => {
      sseClients.delete(token);
      logger.info('SSE client disconnected', { adminId: session.admin_id });
    });
  };
}

/**
 * Broadcasts a typed message to all connected SSE clients.
 * Used for attendance_event and anomaly_alert messages.
 *
 * @param {string} type - The message type (e.g., 'attendance_event', 'anomaly_alert')
 * @param {object} data - The message payload
 * @returns {number} The number of SSE clients the message was delivered to
 */
function broadcastSSE(type, data) {
  const message = `data: ${JSON.stringify({ type, data })}\n\n`;
  let delivered = 0;

  for (const [sessionId, res] of sseClients) {
    try {
      res.write(message);
      delivered++;
    } catch (err) {
      logger.error('SSE delivery failed', { sessionId: sessionId.substring(0, 8) + '...' });
      sseClients.delete(sessionId);
    }
  }

  if (delivered > 0) {
    logger.debug('SSE broadcast complete', { type, delivered });
  }

  return delivered;
}

/**
 * Returns the number of currently connected SSE clients.
 * @returns {number}
 */
function getSSEClientCount() {
  return sseClients.size;
}

module.exports = { createSSEHandler, broadcastSSE, getSSEClientCount };
