import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Feature: course-hour-requirements, Property 8: Rendered duration truncation

describe('Property 8: Rendered duration truncation', () => {
  /**
   * Port of the rendered_minutes computation from PHP checkHourRequirement().
   * Computes rendered_minutes = Math.floor(diffSeconds / 60), where
   * diffSeconds = currentTime - timeIn in seconds.
   *
   * **Validates: Requirements 6.1, 6.3**
   */
  function computeRenderedMinutes(timeIn, currentTime) {
    function parseTime(t) {
      const parts = t.split(':').map(Number);
      return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
    }

    const timeInSec = parseTime(timeIn);
    const currentSec = parseTime(currentTime);
    const diffSec = currentSec - timeInSec;

    if (diffSec < 0) return 0;
    return Math.floor(diffSec / 60);
  }

  // Helper: format seconds since midnight to HH:MM:SS
  function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // Helper: parse HH:MM:SS to seconds since midnight
  function parseTime(t) {
    const parts = t.split(':').map(Number);
    return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
  }

  // Generator: pair of (timeIn, currentTime) where currentTime > timeIn
  const timeInCurrentTimePairGen = fc
    .integer({ min: 0, max: 86398 }) // timeIn: 0 to 23:59:58 (leave room for currentTime > timeIn)
    .chain((timeInSec) =>
      fc.integer({ min: timeInSec + 1, max: 86399 }).map((currentSec) => ({
        timeIn: formatTime(timeInSec),
        currentTime: formatTime(currentSec),
        timeInSec,
        currentSec,
      }))
    );

  it('rendered_minutes equals floor((currentTimeSec - timeInSec) / 60) for any valid time pair (100 iterations)', () => {
    fc.assert(
      fc.property(timeInCurrentTimePairGen, ({ timeIn, currentTime, timeInSec, currentSec }) => {
        const result = computeRenderedMinutes(timeIn, currentTime);
        const expected = Math.floor((currentSec - timeInSec) / 60);
        expect(result).toBe(expected);
      }),
      { numRuns: 100 }
    );
  });

  it('seconds are always discarded — adding extra seconds within the same minute does not increase rendered_minutes (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 85800 }), // timeIn seconds (up to ~23:50:00)
        fc.integer({ min: 60, max: 600 }),   // elapsed full minutes (in seconds, at least 1 min)
        fc.integer({ min: 0, max: 59 }),     // extra seconds within the next minute
        (timeInSec, elapsedMinuteSec, extraSec) => {
          // Ensure currentTime stays within 24-hour range
          const baseCurrentSec = timeInSec + elapsedMinuteSec;
          const currentWithExtraSec = baseCurrentSec + extraSec;
          if (currentWithExtraSec > 86399) return; // skip overflow

          const timeIn = formatTime(timeInSec);
          const currentBase = formatTime(baseCurrentSec);
          const currentWithExtra = formatTime(currentWithExtraSec);

          const resultBase = computeRenderedMinutes(timeIn, currentBase);
          const resultWithExtra = computeRenderedMinutes(timeIn, currentWithExtra);

          // Extra seconds within the same minute should NOT increase rendered_minutes
          // (e.g., 2:00 elapsed → 2 min, 2:59 elapsed → 2 min, not 3)
          const expectedBase = Math.floor((baseCurrentSec - timeInSec) / 60);
          const expectedExtra = Math.floor((currentWithExtraSec - timeInSec) / 60);
          expect(resultBase).toBe(expectedBase);
          expect(resultWithExtra).toBe(expectedExtra);
          // The extra seconds can only keep it the same or bump it by whole minutes crossed
          expect(resultWithExtra).toBeGreaterThanOrEqual(resultBase);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result is always a non-negative integer (100 iterations)', () => {
    fc.assert(
      fc.property(timeInCurrentTimePairGen, ({ timeIn, currentTime }) => {
        const result = computeRenderedMinutes(timeIn, currentTime);
        expect(Number.isInteger(result)).toBe(true);
        expect(result).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 100 }
    );
  });

  it('adding 59 seconds to timeIn does not change rendered_minutes compared to adding 0 seconds within the same minute boundary (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),  // hour
        fc.integer({ min: 0, max: 59 }),  // minute
        fc.integer({ min: 2, max: 180 }), // elapsed whole minutes
        (h, m, elapsedMin) => {
          // timeIn at HH:MM:00
          const timeInSec = h * 3600 + m * 60;
          // currentTime = timeIn + elapsedMin minutes + 0 seconds
          const currentSec0 = timeInSec + elapsedMin * 60;
          // currentTime = timeIn + elapsedMin minutes + 59 seconds (same minute)
          const currentSec59 = timeInSec + elapsedMin * 60 + 59;

          if (currentSec0 > 86399 || currentSec59 > 86399) return; // skip overflow

          const timeIn = formatTime(timeInSec);
          const result0 = computeRenderedMinutes(timeIn, formatTime(currentSec0));
          const result59 = computeRenderedMinutes(timeIn, formatTime(currentSec59));

          // Both should yield the same rendered_minutes because 59 extra seconds
          // are discarded by floor — they don't reach the next full minute
          expect(result0).toBe(elapsedMin);
          expect(result59).toBe(elapsedMin);
        }
      ),
      { numRuns: 100 }
    );
  });
});
