/**
 * Duplicate suppression for anomaly alerts.
 * Prevents the same student + pattern_type from being broadcast
 * more than once within a 24-hour window.
 */

// Key: `${student_id}:${pattern_type}`
// Value: ISO timestamp of last broadcast alert
const recentAlerts = new Map();

/**
 * Determines whether an alert should be broadcast based on 24-hour suppression.
 *
 * @param {object} alert - The anomaly alert object
 * @param {number} alert.student_id - Student identifier
 * @param {string} alert.pattern_type - Anomaly pattern type
 * @param {string} alert.detected_at - ISO 8601 detection timestamp
 * @returns {boolean} true if the alert should be broadcast, false if suppressed
 */
function shouldBroadcast(alert) {
  const key = `${alert.student_id}:${alert.pattern_type}`;
  const lastBroadcast = recentAlerts.get(key);

  if (lastBroadcast) {
    const hoursSince = (Date.now() - new Date(lastBroadcast).getTime()) / 3600000;
    if (hoursSince < 24) return false;
  }

  recentAlerts.set(key, alert.detected_at);
  return true;
}

/**
 * Clears all tracked alerts. Useful for testing.
 */
function clear() {
  recentAlerts.clear();
}

/**
 * Returns the current size of the deduplication map.
 * @returns {number}
 */
function size() {
  return recentAlerts.size;
}

module.exports = { shouldBroadcast, clear, size };
