// Feature: realtime-anomaly-detection, Property 15: Score-to-Severity Color Mapping
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getSeverityColor } from '../../utils/severityColor.js';

/**
 * **Validates: Requirements 5.5**
 *
 * For any Anomaly_Score s where s ≥ 0.7, the assigned severity color SHALL be:
 * - yellow when 0.7 ≤ s < 0.8
 * - orange when 0.8 ≤ s < 0.9
 * - red when 0.9 ≤ s ≤ 1.0
 * Scores below 0.7 → 'none'
 */
describe('Property 15: Score-to-Severity Color Mapping', () => {
  it('scores in [0.7, 0.8) map to yellow', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.7, max: 0.8, noNaN: true, maxExcluded: true }),
        (score) => {
          expect(getSeverityColor(score)).toBe('yellow');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('scores in [0.8, 0.9) map to orange', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.8, max: 0.9, noNaN: true, maxExcluded: true }),
        (score) => {
          expect(getSeverityColor(score)).toBe('orange');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('scores in [0.9, 1.0] map to red', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.9, max: 1.0, noNaN: true }),
        (score) => {
          expect(getSeverityColor(score)).toBe('red');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('scores below 0.7 map to none', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.0, max: 0.7, noNaN: true, maxExcluded: true }),
        (score) => {
          expect(getSeverityColor(score)).toBe('none');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('boundary values are correctly categorized', () => {
    // Exact boundary tests
    expect(getSeverityColor(0.7)).toBe('yellow');
    expect(getSeverityColor(0.8)).toBe('orange');
    expect(getSeverityColor(0.9)).toBe('red');
    expect(getSeverityColor(1.0)).toBe('red');
    expect(getSeverityColor(0.0)).toBe('none');
    expect(getSeverityColor(0.69)).toBe('none');
  });
});
