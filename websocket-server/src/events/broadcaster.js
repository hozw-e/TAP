const { WebSocket } = require('ws');
const connectionManager = require('../connections/manager');
const logger = require('../utils/logger');

/**
 * Broadcasts a typed message to all authenticated WebSocket clients.
 * Removes dead connections and logs delivery failures.
 *
 * @param {string} type - The message type (e.g., 'attendance_event', 'anomaly_alert', 'engine_status')
 * @param {object} data - The message payload
 * @returns {number} The number of clients the message was successfully sent to
 */
function broadcast(type, data) {
  const message = JSON.stringify({ type, data });
  const clients = connectionManager.getClients();
  let delivered = 0;

  for (const [sessionId, client] of clients) {
    try {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
        delivered++;
      } else {
        // Connection is no longer open — remove it
        logger.warn('Removing dead connection (not OPEN)', {
          sessionId: sessionId.substring(0, 8) + '...',
          readyState: client.ws.readyState,
        });
        connectionManager.removeClient(sessionId);
      }
    } catch (err) {
      logger.error('Broadcast delivery failed', {
        sessionId: sessionId.substring(0, 8) + '...',
        error: err.message,
      });
      connectionManager.removeClient(sessionId);
    }
  }

  logger.debug('Broadcast complete', { type, delivered, totalClients: clients.size });
  return delivered;
}

module.exports = { broadcast };
