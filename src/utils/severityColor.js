/**
 * Maps an anomaly score to a severity color.
 *
 * Color bands use inclusive lower bounds and exclusive upper bounds:
 * - [0.9, 1.0] → 'red' (critical)
 * - [0.8, 0.9) → 'orange' (elevated)
 * - [0.7, 0.8) → 'yellow' (warning)
 * - below 0.7  → 'none' (below threshold)
 *
 * @param {number} score - Anomaly score between 0.0 and 1.0
 * @returns {'red' | 'orange' | 'yellow' | 'none'}
 */
export function getSeverityColor(score) {
  if (score >= 0.9) return 'red';
  if (score >= 0.8) return 'orange';
  if (score >= 0.7) return 'yellow';
  return 'none';
}
