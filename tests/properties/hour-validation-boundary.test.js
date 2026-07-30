import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Feature: course-hour-requirements, Property 1: Total hours validation boundary

describe('Property 1: Total hours validation boundary', () => {
  /**
   * Port of the PHP validateTotalHours() function.
   * Validates that total_hours is either NULL or a numeric value in [1.0, 200.0].
   *
   * **Validates: Requirements 1.3, 1.4, 5.6**
   */
  function validateTotalHours(value) {
    // NULL means no enforcement — valid
    if (value === null) {
      return { valid: true, error: null, value: null };
    }

    // Reject non-numeric values
    if (typeof value !== 'number' || isNaN(value)) {
      return { valid: false, error: 'total_hours must be a numeric value between 1.0 and 200.0', value: null };
    }

    const floatValue = value;

    // Reject values outside allowed range
    if (floatValue < 1.0 || floatValue > 200.0) {
      return { valid: false, error: 'total_hours must be between 1.0 and 200.0', value: null };
    }

    return { valid: true, error: null, value: floatValue };
  }

  it('accepts values in [1.0, 200.0] as valid (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1.0, max: 200.0, noNaN: true, noDefaultInfinity: true }),
        (value) => {
          const result = validateTotalHours(value);
          expect(result.valid).toBe(true);
          expect(result.error).toBeNull();
          expect(result.value).toBe(value);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects values below 1.0 (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e10, max: 0.99999999, noNaN: true, noDefaultInfinity: true }),
        (value) => {
          const result = validateTotalHours(value);
          expect(result.valid).toBe(false);
          expect(result.error).toBe('total_hours must be between 1.0 and 200.0');
          expect(result.value).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects values above 200.0 (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 200.00000001, max: 1e10, noNaN: true, noDefaultInfinity: true }),
        (value) => {
          const result = validateTotalHours(value);
          expect(result.valid).toBe(false);
          expect(result.error).toBe('total_hours must be between 1.0 and 200.0');
          expect(result.value).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accepts NULL as valid (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.constant(null),
        (value) => {
          const result = validateTotalHours(value);
          expect(result.valid).toBe(true);
          expect(result.error).toBeNull();
          expect(result.value).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
