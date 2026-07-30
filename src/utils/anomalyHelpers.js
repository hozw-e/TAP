/**
 * Utility functions for anomaly detection display logic.
 */

/**
 * Maps an anomaly score to a severity color string.
 * - 0.9 to 1.0 (inclusive): 'red' (critical)
 * - 0.8 to 0.9 (exclusive upper): 'orange' (elevated)
 * - 0.7 to 0.8 (exclusive upper): 'yellow' (warning)
 * - Below 0.7: 'none' (below threshold)
 *
 * @param {number} score - Anomaly score between 0.0 and 1.0
 * @returns {'red'|'orange'|'yellow'|'none'}
 */
export function getSeverityColor(score) {
  if (score >= 0.9) return 'red';
  if (score >= 0.8) return 'orange';
  if (score >= 0.7) return 'yellow';
  return 'none';
}
