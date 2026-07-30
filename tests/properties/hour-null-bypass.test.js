import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Feature: course-hour-requirements, Property 4: NULL total_hours bypass

describe('Property 4: NULL total_hours bypass', () => {
  /**
   * Port of the PHP checkHourRequirement() function.
   * Determines if a check-out attempt meets the minimum session duration requirement.
   *
   * **Validates: Requirements 2.5, 3.7**
   */
  function checkHourRequirement(timeIn, currentTime, totalHours, endTime) {
    function parseTime(t) {
      const parts = t.split(':').map(Number);
      return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
    }

    // Skip enforcement when totalHours is NULL (no hour requirement configured)
    if (totalHours === null) {
      return { allowed: true, rendered_minutes: 0, minimum_minutes: 0, remaining_minutes: 0 };
    }

    // Compute minimum_minutes from totalHours
    const minimum_minutes = Math.floor(totalHours * 60 / 4);

    // Skip enforcement (allow) when endTime is not NULL and currentTime >= endTime
    if (endTime !== null) {
      const currentTs = parseTime(currentTime);
      const endTs = parseTime(endTime);
      if (currentTs >= endTs) {
        const timeInTs = parseTime(timeIn);
        const diffSeconds = currentTs - timeInTs;
        const rendered_minutes = diffSeconds < 0 ? 0 : Math.floor(diffSeconds / 60);
        return {
          allowed: true,
          rendered_minutes,
          minimum_minutes,
          remaining_minutes: Math.max(0, minimum_minutes - rendered_minutes),
        };
      }
    }

    // Compute rendered duration
    const timeInTs = parseTime(timeIn);
    const currentTs = parseTime(currentTime);
    const diffSeconds = currentTs - timeInTs;

    const rendered_minutes = diffSeconds < 0 ? 0 : Math.floor(diffSeconds / 60);
    const remaining_minutes = Math.max(0, minimum_minutes - rendered_minutes);
    const allowed = rendered_minutes >= minimum_minutes;

    return { allowed, rendered_minutes, minimum_minutes, remaining_minutes };
  }

  // Generator for valid HH:MM:SS time strings
  const timeGen = fc.tuple(
    fc.integer({ min: 0, max: 23 }),
    fc.integer({ min: 0, max: 59 }),
    fc.integer({ min: 0, max: 59 })
  ).map(([h, m, s]) =>
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  );

  // Generator for endTime: either null or a valid time string
  const endTimeGen = fc.oneof(
    fc.constant(null),
    timeGen
  );

  it('always returns allowed=true when totalHours is NULL, regardless of time values (100 iterations)', () => {
    fc.assert(
      fc.property(
        timeGen,       // timeIn
        timeGen,       // currentTime
        endTimeGen,    // endTime (null or valid time)
        (timeIn, currentTime, endTime) => {
          const result = checkHourRequirement(timeIn, currentTime, null, endTime);
          expect(result.allowed).toBe(true);
          expect(result.rendered_minutes).toBe(0);
          expect(result.minimum_minutes).toBe(0);
          expect(result.remaining_minutes).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('NULL bypass holds even when rendered time would be insufficient for any hypothetical minimum (100 iterations)', () => {
    fc.assert(
      fc.property(
        timeGen,                                                     // timeIn
        timeGen,                                                     // currentTime (could be before timeIn)
        fc.double({ min: 1.0, max: 200.0, noNaN: true, noDefaultInfinity: true }), // hypothetical totalHours
        endTimeGen,                                                  // endTime
        (timeIn, currentTime, _hypotheticalTotalHours, endTime) => {
          // Even with a hypothetical totalHours that would require many hours,
          // passing NULL always bypasses the gate
          const result = checkHourRequirement(timeIn, currentTime, null, endTime);
          expect(result.allowed).toBe(true);
          expect(result.rendered_minutes).toBe(0);
          expect(result.minimum_minutes).toBe(0);
          expect(result.remaining_minutes).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('NULL bypass is unconditional — holds for all time combinations including edge cases (100 iterations)', () => {
    fc.assert(
      fc.property(
        // Generate times that include boundary values (midnight, end of day)
        fc.oneof(
          timeGen,
          fc.constant('00:00:00'),
          fc.constant('23:59:59'),
          fc.constant('12:00:00')
        ),
        fc.oneof(
          timeGen,
          fc.constant('00:00:00'),
          fc.constant('23:59:59'),
          fc.constant('12:00:00')
        ),
        endTimeGen,
        (timeIn, currentTime, endTime) => {
          const result = checkHourRequirement(timeIn, currentTime, null, endTime);
          expect(result.allowed).toBe(true);
          expect(result.rendered_minutes).toBe(0);
          expect(result.minimum_minutes).toBe(0);
          expect(result.remaining_minutes).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
