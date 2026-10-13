const config = require('../config');
const logger = require('../utils/logger');

/**
 * Validates an opaque WebSocket token by calling the PHP validate endpoint.
 * The token is a dedicated credential (see /api/auth/ws-token.php), NOT the
 * raw PHP session ID — the session ID never leaves the backend.
 * @param {string} wsToken - The opaque WebSocket token to validate
 * @returns {Promise<{valid: boolean, admin_id?: number, admin_name?: string}>}
 */
async function validateSession(wsToken) {
  if (!wsToken) {
    return { valid: false };
  }

  const url = `${config.phpSessionValidateUrl}?token=${encodeURIComponent(wsToken)}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      logger.warn('Session validation returned non-OK status', {
        statusCode: response.status,
        token: wsToken.substring(0, 8) + '...',
      });
      return { valid: false };
    }

    const data = await response.json();

    if (data.valid) {
      return {
        valid: true,
        admin_id: data.admin_id,
        admin_name: data.admin_name,
      };
    }

    return { valid: false };
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.warn('Session validation timed out', {
        token: wsToken.substring(0, 8) + '...',
      });
    } else {
      logger.error('Session validation failed', {
        error: err.message,
        token: wsToken.substring(0, 8) + '...',
      });
    }
    return { valid: false };
  }
}

module.exports = { validateSession };
