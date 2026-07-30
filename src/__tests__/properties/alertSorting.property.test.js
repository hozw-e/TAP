// Feature: realtime-anomaly-detection, Property 12: Alert Insertion Maintains Sorted Order
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { insertAlertSorted } from '../../hooks/useAnomalyAlerts.js';

/**
 * **Validates: Requirements 4.4, 5.3**
 *
 * For any list of alerts and any new Anomaly_Alert added,
 * the resulting list SHALL be sorted by Anomaly_Score in descending order,
 * with ties broken by detection timestamp in descending order.
 */

/** Arbitrary for generating a valid alert object */
const alertArb = fc.record({
  student_id: fc.integer({ min: 1, max: 1000 }),
  student_name: fc.string({ minLength: 1, maxLength: 50 }),
  pattern_type: fc.constantFrom('chronic_tardiness', 'attendance_dropoff', 'irregular_timing', 'early_departure'),
  score: fc.double({ min: 0.0, max: 1.0, noNaN: true }),
  description: fc.string({ minLength: 1, maxLength: 100 }),
  detected_at: fc.integer({
    min: new Date('2024-01-01T00:00:00Z').getTime(),
    max: new Date('2025-12-31T23:59:59Z').getTime(),
  }).map(ts => new Date(ts).toISOString()),
});

/**
 * Helper: check if a list is sorted by score DESC, then detected_at DESC
 */
function isSortedCorrectly(alerts) {
  for (let i = 0; i < alerts.length - 1; i++) {
    const a = alerts[i];
    const b = alerts[i + 1];
    if (a.score < b.score) return false;
    if (a.score === b.score) {
      if (new Date(a.detected_at) < new Date(b.detected_at)) return false;
    }
  }
  return true;
}

describe('Property 12: Alert Insertion Maintains Sorted Order', () => {
  it('after any sequence of insertions, the list is always sorted by score DESC, ties broken by detected_at DESC', () => {
    fc.assert(
      fc.property(
        fc.array(alertArb, { minLength: 0, maxLength: 20 }),
        alertArb,
        (existingAlerts, newAlert) => {
          // Build a sorted list by inserting alerts one by one
          let sorted = [];
          for (const alert of existingAlerts) {
            sorted = insertAlertSorted(sorted, alert);
          }

          // Insert the new alert
          const result = insertAlertSorted(sorted, newAlert);

          // Verify sorted order
          expect(isSortedCorrectly(result)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('the inserted alert appears in the resulting list', () => {
    fc.assert(
      fc.property(
        fc.array(alertArb, { minLength: 0, maxLength: 20 }),
        alertArb,
        (existingAlerts, newAlert) => {
          // Build a sorted list
          let sorted = [];
          for (const alert of existingAlerts) {
            sorted = insertAlertSorted(sorted, alert);
          }

          const result = insertAlertSorted(sorted, newAlert);

          // The new alert must be present in the result
          const found = result.some(
            a => a.student_id === newAlert.student_id &&
                 a.score === newAlert.score &&
                 a.detected_at === newAlert.detected_at &&
                 a.pattern_type === newAlert.pattern_type
          );
          expect(found).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result length equals input length + 1 (when under max cap)', () => {
    fc.assert(
      fc.property(
        fc.array(alertArb, { minLength: 0, maxLength: 20 }),
        alertArb,
        (existingAlerts, newAlert) => {
          // Build a sorted list
          let sorted = [];
          for (const alert of existingAlerts) {
            sorted = insertAlertSorted(sorted, alert);
          }

          const result = insertAlertSorted(sorted, newAlert);

          // Since we're inserting into lists of max 20, well under the 100 cap
          expect(result.length).toBe(sorted.length + 1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
