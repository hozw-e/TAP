const config = require('../config');
const logger = require('../utils/logger');

/**
 * Validates a PHP session token by calling the PHP validate-session endpoint.
 * @param {string} sessionId - The PHP session ID token to validate
 * @returns {Promise<{valid: boolean, admin_id?: number, admin_name?: string}>}
 */
async function validateSession(sessionId) {
  if (!sessionId) {
    return { valid: false };
  }

  const url = `${config.phpSessionValidateUrl}?session_id=${encodeURIComponent(sessionId)}`;

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
        sessionId: sessionId.substring(0, 8) + '...',
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
        sessionId: sessionId.substring(0, 8) + '...',
      });
    } else {
      logger.error('Session validation failed', {
        error: err.message,
        sessionId: sessionId.substring(0, 8) + '...',
      });
    }
    return { valid: false };
  }
}

module.exports = { validateSession };
