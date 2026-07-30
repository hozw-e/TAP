const config = require('../config');
const logger = require('../utils/logger');

/**
 * Sends an attendance event to the Python anomaly engine for analysis.
 * Uses a 2-second timeout via AbortController.
 *
 * @param {object} event - The attendance event payload
 * @returns {Promise<{alerts: Array}|null>} Analysis result with alerts array, or null on failure
 */
async function analyzeEvent(event) {
  const url = `${config.anomalyEngineUrl}/analyze`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.warn('Anomaly engine returned non-OK status', {
        status: response.status,
        url,
      });
      return null;
    }

    const data = await response.json();
    return data;
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.warn('Anomaly engine request timed out (2s)', { url });
    } else {
      logger.error('Anomaly engine request failed', {
        error: err.message,
        url,
      });
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { analyzeEvent };
