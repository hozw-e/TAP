// Feature: realtime-anomaly-detection, Property 3: Log List Prepend Invariant
// **Validates: Requirements 2.3**

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Helper: prepends a new entry to existing logs and caps at pageSize.
 * This is the pure logic under test.
 */
function prependLog(existingLogs, newEntry, pageSize = 10) {
  const updated = [newEntry, ...existingLogs];
  return updated.slice(0, pageSize);
}

describe('Property 3: Log List Prepend Invariant', () => {
  const logEntryArb = fc.record({
    student_id: fc.integer({ min: 1, max: 100000 }),
    student_name: fc.string({ minLength: 1, maxLength: 100 }),
    action: fc.constantFrom('check_in', 'check_out'),
    timestamp: fc.integer({
      min: new Date('2020-01-01').getTime(),
      max: new Date('2030-12-31').getTime(),
    }).map((ms) => new Date(ms).toISOString()),
  });

  it('new entry is always at index 0', () => {
    fc.assert(
      fc.property(
        fc.array(logEntryArb, { minLength: 0, maxLength: 20 }),
        logEntryArb,
        fc.integer({ min: 1, max: 50 }),
        (existingLogs, newEntry, pageSize) => {
          const result = prependLog(existingLogs, newEntry, pageSize);
          expect(result[0]).toEqual(newEntry);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('list length never exceeds pageSize', () => {
    fc.assert(
      fc.property(
        fc.array(logEntryArb, { minLength: 0, maxLength: 20 }),
        logEntryArb,
        fc.integer({ min: 1, max: 50 }),
        (existingLogs, newEntry, pageSize) => {
          const result = prependLog(existingLogs, newEntry, pageSize);
          expect(result.length).toBeLessThanOrEqual(pageSize);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('list length equals min(existingLogs.length + 1, pageSize)', () => {
    fc.assert(
      fc.property(
        fc.array(logEntryArb, { minLength: 0, maxLength: 20 }),
        logEntryArb,
        fc.integer({ min: 1, max: 50 }),
        (existingLogs, newEntry, pageSize) => {
          const result = prependLog(existingLogs, newEntry, pageSize);
          const expectedLength = Math.min(existingLogs.length + 1, pageSize);
          expect(result.length).toBe(expectedLength);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('relative order of existing entries is preserved', () => {
    fc.assert(
      fc.property(
        fc.array(logEntryArb, { minLength: 0, maxLength: 20 }),
        logEntryArb,
        fc.integer({ min: 1, max: 50 }),
        (existingLogs, newEntry, pageSize) => {
          const result = prependLog(existingLogs, newEntry, pageSize);
          // The entries after index 0 should be the existing logs (up to pageSize - 1)
          const keptExisting = result.slice(1);
          const expectedExisting = existingLogs.slice(0, pageSize - 1);
          expect(keptExisting).toEqual(expectedExisting);
        }
      ),
      { numRuns: 100 }
    );
  });
});
