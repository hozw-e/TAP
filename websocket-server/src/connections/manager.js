const config = require('../config');
const logger = require('../utils/logger');

/**
 * Connection Manager — tracks connected WebSocket clients by session ID.
 */
class ConnectionManager {
  constructor() {
    /** @type {Map<string, {ws: WebSocket, adminId: number, adminName: string, connectedAt: string}>} */
    this.clients = new Map();
  }

  /**
   * Adds a new client connection.
   * @param {string} sessionId - The PHP session ID
   * @param {WebSocket} ws - The WebSocket instance
   * @param {number} adminId - The authenticated admin's ID
   * @param {string} adminName - The authenticated admin's name
   */
  addClient(sessionId, ws, adminId, adminName) {
    this.clients.set(sessionId, {
      ws,
      adminId,
      adminName,
      connectedAt: new Date().toISOString(),
    });
    logger.info('Client added to connection manager', {
      sessionId: sessionId.substring(0, 8) + '...',
      adminId,
      adminName,
      totalClients: this.clients.size,
    });
  }

  /**
   * Removes a client connection by session ID.
   * @param {string} sessionId - The PHP session ID to remove
   */
  removeClient(sessionId) {
    const removed = this.clients.delete(sessionId);
    if (removed) {
      logger.info('Client removed from connection manager', {
        sessionId: sessionId.substring(0, 8) + '...',
        totalClients: this.clients.size,
      });
    }
  }

  /**
   * Returns all active client entries for broadcasting.
   * @returns {Map<string, {ws: WebSocket, adminId: number, adminName: string, connectedAt: string}>}
   */
  getClients() {
    return this.clients;
  }

  /**
   * Gets a specific client by session ID.
   * @param {string} sessionId
   * @returns {{ws: WebSocket, adminId: number, adminName: string, connectedAt: string} | undefined}
   */
  getClient(sessionId) {
    return this.clients.get(sessionId);
  }

  /**
   * Validates that the given origin is in the allowed origins list.
   * @param {string|undefined} origin - The Origin header value
   * @returns {boolean} true if origin is allowed, false otherwise
   */
  validateOrigin(origin) {
    if (!origin) {
      return false;
    }
    return config.allowedOrigins.includes(origin);
  }

  /**
   * Returns the number of connected clients.
   * @returns {number}
   */
  getClientCount() {
    return this.clients.size;
  }
}

// Export a singleton instance
const connectionManager = new ConnectionManager();

module.exports = connectionManager;
