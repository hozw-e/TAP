import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Feature: course-hour-requirements, Property 6: End-time cap override

describe('Property 6: End-time cap override', () => {
  /**
   * Port of the PHP checkHourRequirement() function.
   * Determines if a check-out attempt meets the minimum session duration requirement.
   *
   * **Validates: Requirements 3.3**
   */
  function checkHourRequirement(timeIn, currentTime, totalHours, endTime) {
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

  // Generate a pair where currentTime >= endTime (in seconds since midnight)
  const currentGteEndTimeGen = fc.tuple(
    fc.integer({ min: 0, max: 86399 }),  // endTime in seconds
    fc.integer({ min: 0, max: 86399 })   // offset (currentTime = endTime + offset within day)
  ).map(([endSec, offset]) => {
    // Ensure currentTime >= endTime but both within 00:00:00–23:59:59
    const currentSec = Math.min(endSec + offset, 86399);
    // If currentSec < endSec due to clamping being impossible (endSec already at max), just use endSec
    const finalCurrentSec = currentSec >= endSec ? currentSec : endSec;

    const toTimeStr = (sec) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    return {
      endTime: toTimeStr(endSec),
      currentTime: toTimeStr(finalCurrentSec)
    };
  });

  it('allows check-out when currentTime >= endTime regardless of rendered_minutes (100 iterations)', () => {
    fc.assert(
      fc.property(
        timeGen,                                                        // timeIn
        currentGteEndTimeGen,                                           // { endTime, currentTime }
        fc.double({ min: 1.0, max: 200.0, noNaN: true, noDefaultInfinity: true }), // totalHours
        (timeIn, { endTime, currentTime }, totalHours) => {
          const result = checkHourRequirement(timeIn, currentTime, totalHours, endTime);

          // The end-time cap override must always allow check-out
          expect(result.allowed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('allows check-out even when rendered_minutes < minimum_minutes due to end-time cap (100 iterations)', () => {
    // Generate scenarios where student definitely hasn't met the hour requirement:
    // - Large totalHours (high minimum)
    // - Recent timeIn (short duration)
    // - endTime before currentTime (cap triggered)
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),   // endHour
        fc.integer({ min: 0, max: 59 }),   // endMinute
        fc.integer({ min: 0, max: 59 }),   // endSecond
        fc.integer({ min: 0, max: 3599 }), // offsetAfterEnd (seconds past endTime for currentTime)
        fc.integer({ min: 0, max: 30 }),   // minutesBeforeCurrent (how recently they checked in)
        fc.double({ min: 10.0, max: 200.0, noNaN: true, noDefaultInfinity: true }), // large totalHours
        (endH, endM, endS, offsetAfterEnd, minutesBefore, totalHours) => {
          const endSec = endH * 3600 + endM * 60 + endS;
          const currentSec = Math.min(endSec + offsetAfterEnd, 86399);

          // Ensure currentTime >= endTime
          if (currentSec < endSec) return; // skip if clamping made it invalid

          const timeInSec = Math.max(0, currentSec - minutesBefore * 60);

          const toTimeStr = (sec) => {
            const h = Math.floor(sec / 3600);
            const m = Math.floor((sec % 3600) / 60);
            const s = sec % 60;
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
          };

          const endTime = toTimeStr(endSec);
          const currentTime = toTimeStr(currentSec);
          const timeIn = toTimeStr(timeInSec);

          const minimum_minutes = Math.floor(totalHours * 60 / 4);
          const renderedMinutes = Math.floor((currentSec - timeInSec) / 60);

          // Only test cases where rendered < minimum (student hasn't met requirement)
          if (renderedMinutes >= minimum_minutes) return;

          const result = checkHourRequirement(timeIn, currentTime, totalHours, endTime);

          // End-time cap override must still allow check-out
          expect(result.allowed).toBe(true);
          expect(result.rendered_minutes).toBe(renderedMinutes);
          expect(result.minimum_minutes).toBe(minimum_minutes);
          expect(result.remaining_minutes).toBe(minimum_minutes - renderedMinutes);
        }
      ),
      { numRuns: 100 }
    );
  });
});
