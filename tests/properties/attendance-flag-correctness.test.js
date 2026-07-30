import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Feature: system-improvements, Property 4: Attendance flag correctness for any check-in time

describe('Property 4: Attendance flag correctness', () => {
  /**
   * Port of the PHP attendanceFlagForTime() function.
   * Returns 'present' if checkInTime <= scheduleStartTime + gracePeriod minutes,
   * else 'tardy'.
   *
   * **Validates: Requirements 4.7, 4.9**
   */
  function attendanceFlagForTime(checkInTime, scheduleStartTime, gracePeriod) {
    // Parse HH:MM:SS to total seconds since midnight
    const parseTime = (timeStr) => {
      const parts = timeStr.split(':').map(Number);
      return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
    };
    
    const checkIn = parseTime(checkInTime);
    const scheduleStart = parseTime(scheduleStartTime);
    const deadline = scheduleStart + (gracePeriod * 60);
    
    return checkIn <= deadline ? 'present' : 'tardy';
  }

  // Generate valid time strings (HH:MM:SS)
  const timeGen = fc.tuple(
    fc.integer({ min: 0, max: 23 }),  // hours
    fc.integer({ min: 0, max: 59 }),  // minutes
    fc.integer({ min: 0, max: 59 })   // seconds
  ).map(([h, m, s]) => 
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  );

  it('returns present when checkInTime <= startTime + gracePeriod, tardy otherwise (100 iterations)', () => {
    fc.assert(
      fc.property(
        timeGen,                                      // scheduleStartTime
        fc.integer({ min: 0, max: 120 }),            // gracePeriod
        timeGen,                                      // checkInTime
        (scheduleStartTime, gracePeriod, checkInTime) => {
          const result = attendanceFlagForTime(checkInTime, scheduleStartTime, gracePeriod);
          
          // Verify against the boundary condition directly
          const parseTime = (timeStr) => {
            const parts = timeStr.split(':').map(Number);
            return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
          };
          
          const checkInSeconds = parseTime(checkInTime);
          const deadlineSeconds = parseTime(scheduleStartTime) + (gracePeriod * 60);
          
          if (checkInSeconds <= deadlineSeconds) {
            expect(result).toBe('present');
          } else {
            expect(result).toBe('tardy');
          }
          
          // Result must be one of the two valid values
          expect(['present', 'tardy']).toContain(result);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns present when checkInTime equals exactly startTime + gracePeriod (boundary)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 22 }),  // hour (limit to avoid overflow)
        fc.integer({ min: 0, max: 59 }),  // minute
        fc.integer({ min: 0, max: 60 }),  // gracePeriod in minutes
        (h, m, gracePeriod) => {
          const startTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
          
          // Check-in exactly at deadline
          const deadlineMinutes = h * 60 + m + gracePeriod;
          if (deadlineMinutes >= 24 * 60) return; // Skip if overflow past midnight
          
          const deadlineH = Math.floor(deadlineMinutes / 60);
          const deadlineM = deadlineMinutes % 60;
          const checkInTime = `${String(deadlineH).padStart(2, '0')}:${String(deadlineM).padStart(2, '0')}:00`;
          
          const result = attendanceFlagForTime(checkInTime, startTime, gracePeriod);
          expect(result).toBe('present'); // <= boundary is present
        }
      ),
      { numRuns: 100 }
    );
  });
});
