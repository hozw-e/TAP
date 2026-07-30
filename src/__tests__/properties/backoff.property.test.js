// Feature: realtime-anomaly-detection, Property 1: Exponential Backoff Computation
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeBackoffDelay } from '../../hooks/useWebSocket.js';

/**
 * **Validates: Requirements 1.4**
 *
 * For any reconnection attempt number n (where 1 ≤ n ≤ 10),
 * the computed reconnection delay SHALL equal min(2^(n-1) × 1000, 30000) milliseconds.
 */
describe('Property 1: Exponential Backoff Computation', () => {
  it('delay(n) === min(2^(n-1) * 1000, 30000) for any n in [1, 10]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (attempt) => {
          const expected = Math.min(Math.pow(2, attempt - 1) * 1000, 30000);
          const actual = computeBackoffDelay(attempt);
          expect(actual).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('delay is monotonically non-decreasing', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9 }),
        (attempt) => {
          const current = computeBackoffDelay(attempt);
          const next = computeBackoffDelay(attempt + 1);
          expect(next).toBeGreaterThanOrEqual(current);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('delay is never greater than 30000', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (attempt) => {
          const delay = computeBackoffDelay(attempt);
          expect(delay).toBeLessThanOrEqual(30000);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('delay is never less than 1000', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (attempt) => {
          const delay = computeBackoffDelay(attempt);
          expect(delay).toBeGreaterThanOrEqual(1000);
        }
      ),
      { numRuns: 100 }
    );
  });
});
