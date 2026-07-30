const config = require('../config');
const logger = require('../utils/logger');
const { validateSession } = require('../auth/sessionValidator');
const connectionManager = require('./manager');

let heartbeatInterval = null;

/**
 * Starts the periodic session re-validation heartbeat.
 * Runs every config.phpSessionRecheckInterval ms (default 60s).
 * For each connected client, re-validates their session.
 * If session is invalid, closes with custom code 4401 (session expired).
 */
function startHeartbeat() {
  if (heartbeatInterval) {
    logger.warn('Heartbeat already running, skipping start');
    return;
  }

  heartbeatInterval = setInterval(async () => {
    const clients = connectionManager.getClients();

    if (clients.size === 0) {
      return;
    }

    logger.debug('Heartbeat: re-validating sessions', { clientCount: clients.size });

    for (const [sessionId, client] of clients) {
      try {
        const result = await validateSession(sessionId);

        if (!result.valid) {
          logger.info('Heartbeat: session expired, closing connection', {
            sessionId: sessionId.substring(0, 8) + '...',
            adminId: client.adminId,
          });

          // Close with custom code 4401 = session expired
          client.ws.close(4401, 'Session expired');
          connectionManager.removeClient(sessionId);
        }
      } catch (err) {
        logger.error('Heartbeat: error during session re-validation', {
          sessionId: sessionId.substring(0, 8) + '...',
          error: err.message,
        });
      }
    }
  }, config.phpSessionRecheckInterval);

  logger.info('Heartbeat started', { intervalMs: config.phpSessionRecheckInterval });
}

/**
 * Stops the heartbeat interval.
 */
function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    logger.info('Heartbeat stopped');
  }
}

module.exports = { startHeartbeat, stopHeartbeat };
