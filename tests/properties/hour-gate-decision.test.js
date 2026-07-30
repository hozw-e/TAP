import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Feature: course-hour-requirements, Property 3: Hour gate decision correctness

describe('Property 3: Hour gate decision correctness', () => {
  /**
   * Port of the PHP checkHourRequirement() function.
   * Determines if a check-out attempt meets the minimum session duration requirement.
   *
   * **Validates: Requirements 2.2, 2.4, 6.3**
   */
  function checkHourRequirement(timeIn, currentTime, totalHours, endTime) {
    // Parse HH:MM:SS to seconds since midnight
    function parseTime(t) {
      const parts = t.split(':').map(Number);
      return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
    }

    if (totalHours === null) {
      return { allowed: true, rendered_minutes: 0, minimum_minutes: 0, remaining_minutes: 0 };
    }

    const minimum_minutes = Math.floor(totalHours * 60 / 4);

    if (endTime !== null) {
      const currentSec = parseTime(currentTime);
      const endSec = parseTime(endTime);
      if (currentSec >= endSec) {
        const timeInSec = parseTime(timeIn);
        const diffSec = currentSec - timeInSec;
        const rendered = diffSec < 0 ? 0 : Math.floor(diffSec / 60);
        return { allowed: true, rendered_minutes: rendered, minimum_minutes, remaining_minutes: Math.max(0, minimum_minutes - rendered) };
      }
    }

    const timeInSec = parseTime(timeIn);
    const currentSec = parseTime(currentTime);
    const diffSec = currentSec - timeInSec;
    const rendered_minutes = diffSec < 0 ? 0 : Math.floor(diffSec / 60);
    const remaining = Math.max(0, minimum_minutes - rendered_minutes);
    const allowed = rendered_minutes >= minimum_minutes;

    return { allowed, rendered_minutes, minimum_minutes, remaining_minutes: remaining };
  }

  // Generate valid time strings (HH:MM:SS)
  const timeGen = fc.tuple(
    fc.integer({ min: 0, max: 23 }),
    fc.integer({ min: 0, max: 59 }),
    fc.integer({ min: 0, max: 59 })
  ).map(([h, m, s]) =>
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  );

  it('denies check-out iff rendered_minutes < minimum_minutes, allows otherwise (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1.0, max: 200.0, noNaN: true, noDefaultInfinity: true }), // totalHours
        fc.integer({ min: 0, max: 20 }),  // timeIn hour
        fc.integer({ min: 0, max: 59 }),  // timeIn minute
        fc.integer({ min: 0, max: 59 }),  // timeIn second
        fc.integer({ min: 1, max: 600 }), // elapsed minutes (positive, ensures currentTime > timeIn)
        (totalHours, timeInH, timeInM, timeInS, elapsedMin) => {
          // Build timeIn
          const timeIn = `${String(timeInH).padStart(2, '0')}:${String(timeInM).padStart(2, '0')}:${String(timeInS).padStart(2, '0')}`;

          // Compute currentTime by adding elapsed minutes to timeIn
          const timeInSec = timeInH * 3600 + timeInM * 60 + timeInS;
          const currentSec = timeInSec + elapsedMin * 60; // exact minutes, no leftover seconds

          // Skip if currentTime would exceed 23:59:59
          if (currentSec > 23 * 3600 + 59 * 60 + 59) return;

          const currentH = Math.floor(currentSec / 3600);
          const currentM = Math.floor((currentSec % 3600) / 60);
          const currentS = currentSec % 60;
          const currentTime = `${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}:${String(currentS).padStart(2, '0')}`;

          // No end-time cap — only hour gate applies
          const result = checkHourRequirement(timeIn, currentTime, totalHours, null);

          const minimum_minutes = Math.floor(totalHours * 60 / 4);
          const rendered_minutes = elapsedMin; // exact minutes elapsed

          // Core property: deny iff rendered < minimum, allow iff rendered >= minimum
          if (rendered_minutes < minimum_minutes) {
            expect(result.allowed).toBe(false);
          } else {
            expect(result.allowed).toBe(true);
          }

          // Verify computed values
          expect(result.rendered_minutes).toBe(rendered_minutes);
          expect(result.minimum_minutes).toBe(minimum_minutes);
          expect(result.remaining_minutes).toBe(Math.max(0, minimum_minutes - rendered_minutes));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('allows check-out when rendered_minutes exactly equals minimum_minutes (boundary)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1.0, max: 200.0, noNaN: true, noDefaultInfinity: true }), // totalHours
        fc.integer({ min: 0, max: 20 }),  // timeIn hour
        fc.integer({ min: 0, max: 59 }),  // timeIn minute
        (totalHours, timeInH, timeInM) => {
          const minimum_minutes = Math.floor(totalHours * 60 / 4);

          // Build timeIn (use 0 seconds for simplicity)
          const timeIn = `${String(timeInH).padStart(2, '0')}:${String(timeInM).padStart(2, '0')}:00`;

          // Compute currentTime so rendered_minutes exactly equals minimum_minutes
          const timeInSec = timeInH * 3600 + timeInM * 60;
          const currentSec = timeInSec + minimum_minutes * 60;

          // Skip if currentTime would exceed 23:59:59
          if (currentSec > 23 * 3600 + 59 * 60 + 59) return;

          const currentH = Math.floor(currentSec / 3600);
          const currentM = Math.floor((currentSec % 3600) / 60);
          const currentS = currentSec % 60;
          const currentTime = `${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}:${String(currentS).padStart(2, '0')}`;

          const result = checkHourRequirement(timeIn, currentTime, totalHours, null);

          // At exact boundary, should be allowed (rendered >= minimum)
          expect(result.allowed).toBe(true);
          expect(result.rendered_minutes).toBe(minimum_minutes);
          expect(result.remaining_minutes).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
