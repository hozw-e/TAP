// Feature: realtime-anomaly-detection, Property 17: Historical Alert Filtering Correctness
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * **Validates: Requirements 7.3**
 *
 * Historical alert filtering must return only and all alerts matching the filter criteria.
 * The result must always be a subset of the input.
 */

/**
 * Pure filter function matching the AnomalyHistory filtering logic.
 */
function filterAlerts(alerts, { patternType, dateStart, dateEnd }) {
  return alerts.filter((a) => {
    if (patternType && a.pattern_type !== patternType) return false;
    if (dateStart && new Date(a.detected_at) < new Date(dateStart)) return false;
    if (dateEnd && new Date(a.detected_at) > new Date(dateEnd + 'T23:59:59')) return false;
    return true;
  });
}

const PATTERN_TYPES = ['chronic_tardiness', 'attendance_dropoff', 'irregular_timing', 'early_departure'];

// Generator for a single alert object
const alertArb = fc.record({
  alert_id: fc.integer({ min: 1, max: 100000 }),
  student_id: fc.integer({ min: 1, max: 500 }),
  pattern_type: fc.constantFrom(...PATTERN_TYPES),
  score: fc.double({ min: 0.5, max: 1.0, noNaN: true }),
  description: fc.string({ minLength: 1, maxLength: 50 }),
  detected_at: fc.date({
    min: new Date('2024-01-01'),
    max: new Date('2024-12-31'),
  }).map((d) => d.toISOString()),
});

// Generator for a list of alerts
const alertsArb = fc.array(alertArb, { minLength: 0, maxLength: 30 });

// Generator for filter criteria
const filterArb = fc.record({
  patternType: fc.constantFrom('', ...PATTERN_TYPES),
  dateStart: fc.constantFrom('', '2024-03-01', '2024-06-01', '2024-09-01'),
  dateEnd: fc.constantFrom('', '2024-04-30', '2024-07-31', '2024-12-31'),
});

describe('Property 17: Historical Alert Filtering Correctness', () => {
  it('all returned alerts match all filter criteria', () => {
    fc.assert(
      fc.property(alertsArb, filterArb, (alerts, filter) => {
        const result = filterAlerts(alerts, filter);

        for (const alert of result) {
          if (filter.patternType) {
            expect(alert.pattern_type).toBe(filter.patternType);
          }
          if (filter.dateStart) {
            expect(new Date(alert.detected_at) >= new Date(filter.dateStart)).toBe(true);
          }
          if (filter.dateEnd) {
            expect(new Date(alert.detected_at) <= new Date(filter.dateEnd + 'T23:59:59')).toBe(true);
          }
        }
      }),
      { numRuns: 200 }
    );
  });

  it('no alert matching all criteria is excluded', () => {
    fc.assert(
      fc.property(alertsArb, filterArb, (alerts, filter) => {
        const result = filterAlerts(alerts, filter);

        // Every alert in the original list that matches all criteria must be in the result
        for (const alert of alerts) {
          const matchesPattern = !filter.patternType || alert.pattern_type === filter.patternType;
          const matchesStart = !filter.dateStart || new Date(alert.detected_at) >= new Date(filter.dateStart);
          const matchesEnd = !filter.dateEnd || new Date(alert.detected_at) <= new Date(filter.dateEnd + 'T23:59:59');

          if (matchesPattern && matchesStart && matchesEnd) {
            expect(result).toContainEqual(alert);
          }
        }
      }),
      { numRuns: 200 }
    );
  });

  it('result is always a subset of the input', () => {
    fc.assert(
      fc.property(alertsArb, filterArb, (alerts, filter) => {
        const result = filterAlerts(alerts, filter);

        expect(result.length).toBeLessThanOrEqual(alerts.length);
        for (const alert of result) {
          expect(alerts).toContainEqual(alert);
        }
      }),
      { numRuns: 200 }
    );
  });
});
