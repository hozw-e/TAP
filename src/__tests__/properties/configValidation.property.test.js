// Feature: realtime-anomaly-detection, Property 16: Configuration Validation Rejects Out-of-Range Values
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateThreshold, validateWindow } from '../../components/AnomalyConfig.jsx';

/**
 * **Validates: Requirements 6.5, 6.6**
 *
 * Configuration validation must reject threshold values outside [0.5, 1.0]
 * and window values outside [7, 90], while accepting values within range.
 */
describe('Property 16: Configuration Validation Rejects Out-of-Range Values', () => {
  it('rejects threshold values below 0.5', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1000, max: 0.4999, noNaN: true }),
        (value) => {
          const result = validateThreshold(value);
          expect(result.valid).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('rejects threshold values above 1.0', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1.0001, max: 1000, noNaN: true }),
        (value) => {
          const result = validateThreshold(value);
          expect(result.valid).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('accepts threshold values in [0.5, 1.0]', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.5, max: 1.0, noNaN: true }),
        (value) => {
          const result = validateThreshold(value);
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('rejects window values below 7', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 6 }),
        (value) => {
          const result = validateWindow(value);
          expect(result.valid).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('rejects window values above 90', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 91, max: 10000 }),
        (value) => {
          const result = validateWindow(value);
          expect(result.valid).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('accepts window values in [7, 90]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 7, max: 90 }),
        (value) => {
          const result = validateWindow(value);
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });
});
