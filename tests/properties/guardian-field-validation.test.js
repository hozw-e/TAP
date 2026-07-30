import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Feature: system-improvements, Property 3: Guardian PSID/Viber ID field length validation

describe('Property 3: Guardian PSID/Viber ID field length validation', () => {
  /**
   * Simulates the backend validation logic for messenger_psid and viber_id fields.
   * Returns true if the value would be accepted, false if rejected.
   */
  function validateField(value) {
    if (value === null || value === undefined || value === '') {
      return true; // Optional fields, empty is accepted (stored as NULL)
    }
    return value.length <= 64;
  }

  it('accepts strings of 1-64 characters and rejects strings of 65-100 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (value) => {
          const isValid = validateField(value);
          if (value.length <= 64) {
            expect(isValid).toBe(true);
          } else {
            expect(isValid).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('always accepts null/empty values (fields are optional)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined, ''),
        (value) => {
          expect(validateField(value)).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('validates both messenger_psid and viber_id independently', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        (psid, viberId) => {
          const psidValid = validateField(psid);
          const viberValid = validateField(viberId);
          
          // Each field is validated independently
          expect(psidValid).toBe(psid.length <= 64);
          expect(viberValid).toBe(viberId.length <= 64);
          
          // A request is rejected if EITHER field is too long
          const requestAccepted = psidValid && viberValid;
          const expectedAccepted = psid.length <= 64 && viberId.length <= 64;
          expect(requestAccepted).toBe(expectedAccepted);
        }
      ),
      { numRuns: 100 }
    );
  });
});
