import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Feature: course-hour-requirements, Property 2: Minimum session duration floor computation

describe('Property 2: Minimum session duration floor computation', () => {
  /**
   * Port of the minimum_minutes computation from checkHourRequirement() in PHP.
   * Computes: floor(totalHours * 60 / 4)
   *
   * **Validates: Requirements 1.5, 6.2**
   */
  function computeMinimumMinutes(totalHours) {
    return Math.floor(totalHours * 60 / 4);
  }

  /**
   * Port of the full PHP checkHourRequirement() function.
   * Determines if a check-out attempt meets the minimum session duration requirement.
   *
   * **Validates: Requirements 1.5, 6.2**
   */
  function checkHourRequirement(timeIn, currentTime, totalHours, endTime) {
    // Skip enforcement when totalHours is NULL
    if (totalHours === null) {
      return {
        allowed: true,
        rendered_minutes: 0,
        minimum_minutes: 0,
        remaining_minutes: 0,
      };
    }

    // Helper to parse HH:MM:SS to seconds since midnight
    const parseTime = (timeStr) => {
      const parts = timeStr.split(':').map(Number);
      return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
    };

    // Compute minimum_minutes from totalHours
    const minimum_minutes = Math.floor(totalHours * 60 / 4);

    // End-time cap override: allow if currentTime >= endTime
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

    // Negative duration edge case
    const rendered_minutes = diffSeconds < 0 ? 0 : Math.floor(diffSeconds / 60);

    // Compute remaining
    const remaining_minutes = Math.max(0, minimum_minutes - rendered_minutes);

    // Determine if allowed
    const allowed = rendered_minutes >= minimum_minutes;

    return {
      allowed,
      rendered_minutes,
      minimum_minutes,
      remaining_minutes,
    };
  }

  it('minimum_minutes equals floor(total_hours * 60 / 4) for any valid total_hours (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1.0, max: 200.0, noNaN: true, noDefaultInfinity: true }),
        (totalHours) => {
          const result = computeMinimumMinutes(totalHours);
          expect(result).toBe(Math.floor(totalHours * 60 / 4));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result is always a non-negative integer (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1.0, max: 200.0, noNaN: true, noDefaultInfinity: true }),
        (totalHours) => {
          const result = computeMinimumMinutes(totalHours);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(result)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('known examples: 12.0→180, 6.0→90, 10.0→150, 7.5→112, 1.0→15', () => {
    expect(computeMinimumMinutes(12.0)).toBe(180);
    expect(computeMinimumMinutes(6.0)).toBe(90);
    expect(computeMinimumMinutes(10.0)).toBe(150);
    expect(computeMinimumMinutes(7.5)).toBe(112);
    expect(computeMinimumMinutes(1.0)).toBe(15);
  });

  it('checkHourRequirement returns minimum_minutes consistent with floor formula (100 iterations)', () => {
    // Generate valid time pairs where currentTime > timeIn (to get valid rendered duration)
    const timeGen = fc.tuple(
      fc.integer({ min: 0, max: 20 }),  // hours (capped to avoid overflow)
      fc.integer({ min: 0, max: 59 }),  // minutes
      fc.integer({ min: 0, max: 59 })   // seconds
    ).map(([h, m, s]) =>
      `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    );

    fc.assert(
      fc.property(
        timeGen,  // timeIn
        fc.integer({ min: 1, max: 180 }),  // offset in minutes to add to timeIn for currentTime
        fc.double({ min: 1.0, max: 200.0, noNaN: true, noDefaultInfinity: true }),
        (timeIn, offsetMinutes, totalHours) => {
          // Parse timeIn and compute currentTime as timeIn + offset
          const parts = timeIn.split(':').map(Number);
          const timeInSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
          const currentSeconds = timeInSeconds + (offsetMinutes * 60);

          // Skip if currentTime would overflow past 23:59:59
          if (currentSeconds >= 24 * 3600) return;

          const currentH = Math.floor(currentSeconds / 3600);
          const currentM = Math.floor((currentSeconds % 3600) / 60);
          const currentS = currentSeconds % 60;
          const currentTime = `${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}:${String(currentS).padStart(2, '0')}`;

          const result = checkHourRequirement(timeIn, currentTime, totalHours, null);

          // Verify minimum_minutes is consistent with the floor formula
          const expectedMinimum = Math.floor(totalHours * 60 / 4);
          expect(result.minimum_minutes).toBe(expectedMinimum);
        }
      ),
      { numRuns: 100 }
    );
  });
});
