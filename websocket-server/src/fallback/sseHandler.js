const { validateSession } = require('../auth/sessionValidator');
const logger = require('../utils/logger');

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
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

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
