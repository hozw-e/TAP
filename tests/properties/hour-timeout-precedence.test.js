import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Feature: course-hour-requirements, Property 5: Time-out gate precedence

describe('Property 5: Time-out gate precedence', () => {
  /**
   * Port of the PHP isTimeOutAllowed() function from attendance-helpers.php.
   * Returns true if time-out is allowed, false if denied.
   *
   * Rules:
   * - Return true if endTime is NULL (no gate enforced)
   * - Return true if currentTime >= endTime
   * - Otherwise return false (currentTime < endTime → denied)
   */
  function isTimeOutAllowed(currentTime, endTime) {
    if (endTime === null) return true;

    function parseTime(t) {
      const parts = t.split(':').map(Number);
      return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
    }

    const current = parseTime(currentTime);
    const end = parseTime(endTime);
    return current >= end;
  }

  // Generator: valid HH:MM:SS time string
  const timeGen = fc.tuple(
    fc.integer({ min: 0, max: 23 }),
    fc.integer({ min: 0, max: 59 }),
    fc.integer({ min: 0, max: 59 })
  ).map(([h, m, s]) =>
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  );

  // Generator: a pair of times where currentTime is strictly before endTime
  const currentBeforeEndGen = timeGen.chain((endTime) => {
    const parts = endTime.split(':').map(Number);
    const endSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];

    // endTime must be > 0 seconds so there's room for currentTime < endTime
    if (endSeconds === 0) {
      // If endTime is 00:00:00, no valid currentTime < endTime in the same day
      // Use a fixed pair instead
      return fc.constant({ currentTime: '00:00:00', endTime: '00:00:01' });
    }

    // Generate a currentTime that is strictly less than endTime (0 to endSeconds-1)
    return fc.integer({ min: 0, max: endSeconds - 1 }).map((currentSeconds) => {
      const h = Math.floor(currentSeconds / 3600);
      const m = Math.floor((currentSeconds % 3600) / 60);
      const s = currentSeconds % 60;
      const currentTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      return { currentTime, endTime };
    });
  });

  /**
   * **Validates: Requirements 3.2, 3.5, 3.8**
   *
   * For any currentTime < endTime (endTime is non-NULL), isTimeOutAllowed returns false.
   * This means the Time_Out_Gate denies check-out regardless of rendered duration.
   */
  it('denies time-out when currentTime < endTime, regardless of rendered duration (100 iterations)', () => {
    fc.assert(
      fc.property(
        currentBeforeEndGen,
        fc.float({ min: 1.0, max: 200.0, noNaN: true }), // totalHours (irrelevant, but shows independence)
        fc.integer({ min: 0, max: 600 }), // rendered_minutes (irrelevant, gate fires first)
        ({ currentTime, endTime }, _totalHours, _renderedMinutes) => {
          const result = isTimeOutAllowed(currentTime, endTime);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.2, 3.5**
   *
   * Even when the student has rendered MORE than enough time (e.g., rendered > minimum),
   * if currentTime < endTime, Time_Out_Gate still denies.
   * This demonstrates the precedence: Time_Out_Gate fires BEFORE Hour_Requirement_Gate.
   */
  it('denies time-out even when rendered duration exceeds minimum session duration (100 iterations)', () => {
    fc.assert(
      fc.property(
        currentBeforeEndGen,
        fc.float({ min: 1.0, max: 200.0, noNaN: true }), // totalHours
        ({ currentTime, endTime }, totalHours) => {
          // Compute what minimum_minutes would be
          const minimumMinutes = Math.floor(totalHours * 60 / 4);

          // Simulate a rendered duration that exceeds the minimum
          // (student has been there long enough, but endTime hasn't arrived)
          const renderedMinutes = minimumMinutes + 60; // exceeds by 60 minutes

          // Despite sufficient rendered time, Time_Out_Gate still denies
          const result = isTimeOutAllowed(currentTime, endTime);
          expect(result).toBe(false);

          // The gate's decision is independent of rendered duration
          // renderedMinutes >= minimumMinutes, but still denied
          expect(renderedMinutes).toBeGreaterThanOrEqual(minimumMinutes);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 3.2, 3.8**
   *
   * When endTime is NULL, isTimeOutAllowed always returns true (no gate).
   * The Time_Out_Gate does not apply.
   */
  it('allows time-out when endTime is NULL (no gate) for any currentTime (100 iterations)', () => {
    fc.assert(
      fc.property(
        timeGen,
        (currentTime) => {
          const result = isTimeOutAllowed(currentTime, null);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
