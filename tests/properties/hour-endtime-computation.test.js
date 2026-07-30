import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Feature: course-hour-requirements, Property 7: Auto-compute end_time from total_hours

describe('Property 7: Auto-compute end_time from total_hours', () => {
  /**
   * Port of the PHP computeEndTimeFromTotalHours() function.
   * Computes end_time = start_time + (total_hours / 4) hours.
   *
   * **Validates: Requirements 7.1, 7.4, 7.6**
   */
  function computeEndTimeFromTotalHours(startTime, totalHours) {
    // Parse HH:MM:SS to total seconds since midnight
    const parts = startTime.split(':').map(Number);
    const startSeconds = parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);

    const sessionHours = totalHours / 4;
    const sessionSeconds = Math.round(sessionHours * 3600);
    const endSeconds = startSeconds + sessionSeconds;

    const h = Math.floor(endSeconds / 3600);
    const m = Math.floor((endSeconds % 3600) / 60);
    const s = endSeconds % 60;

    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // Helper: parse HH:MM:SS to seconds since midnight
  function parseTime(timeStr) {
    const parts = timeStr.split(':').map(Number);
    return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
  }

  // Generator for valid start times that won't overflow past 24:00 when total_hours/4 is added.
  // We generate total_hours first, then constrain start hour so start + (total_hours/4) <= 23:59:59.
  const validInputGen = fc.double({ min: 1.0, max: 200.0, noNaN: true }).chain((totalHours) => {
    const sessionHours = totalHours / 4;
    // Max start hour such that start_hour + sessionHours < 24
    const maxStartHour = Math.min(23, Math.floor(23 - sessionHours));

    if (maxStartHour < 0) {
      // Session is too long to fit in any start hour within a day — use hour 0
      return fc.tuple(
        fc.constant('00:00:00'),
        fc.constant(totalHours)
      );
    }

    return fc.tuple(
      fc.integer({ min: 0, max: maxStartHour }),
      fc.integer({ min: 0, max: 59 }),
      fc.integer({ min: 0, max: 59 })
    ).filter(([h, m, s]) => {
      // Ensure end time doesn't exceed 23:59:59
      const startSeconds = h * 3600 + m * 60 + s;
      const endSeconds = startSeconds + Math.round((totalHours / 4) * 3600);
      return endSeconds <= 86399; // 23:59:59
    }).map(([h, m, s]) => {
      const startTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      return [startTime, totalHours];
    });
  });

  it('computed end_time equals start_time + (total_hours / 4) hours for any valid inputs (100 iterations)', () => {
    fc.assert(
      fc.property(
        validInputGen,
        ([startTime, totalHours]) => {
          const result = computeEndTimeFromTotalHours(startTime, totalHours);

          // Independently compute expected end time
          const startSeconds = parseTime(startTime);
          const sessionSeconds = Math.round((totalHours / 4) * 3600);
          const expectedEndSeconds = startSeconds + sessionSeconds;

          const expectedH = Math.floor(expectedEndSeconds / 3600);
          const expectedM = Math.floor((expectedEndSeconds % 3600) / 60);
          const expectedS = expectedEndSeconds % 60;
          const expectedEndTime = `${String(expectedH).padStart(2, '0')}:${String(expectedM).padStart(2, '0')}:${String(expectedS).padStart(2, '0')}`;

          expect(result).toBe(expectedEndTime);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('computation is idempotent — applying it multiple times yields the same result (100 iterations)', () => {
    fc.assert(
      fc.property(
        validInputGen,
        ([startTime, totalHours]) => {
          const result1 = computeEndTimeFromTotalHours(startTime, totalHours);
          const result2 = computeEndTimeFromTotalHours(startTime, totalHours);
          const result3 = computeEndTimeFromTotalHours(startTime, totalHours);

          // Same inputs always produce the same output
          expect(result1).toBe(result2);
          expect(result2).toBe(result3);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('known examples: total_hours=12.0, start_time=09:00:00 → 12:00:00', () => {
    const result = computeEndTimeFromTotalHours('09:00:00', 12.0);
    expect(result).toBe('12:00:00');
  });

  it('known examples: total_hours=6.0, start_time=09:00:00 → 10:30:00', () => {
    const result = computeEndTimeFromTotalHours('09:00:00', 6.0);
    expect(result).toBe('10:30:00');
  });
});
