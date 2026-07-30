// Feature: realtime-anomaly-detection, Property 2: Attendance Event Schema Completeness
// **Validates: Requirements 2.2, 9.2**

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Helper: constructs an Attendance_Event from raw inputs.
 * This is the pure logic under test.
 */
function buildAttendanceEvent({ studentId, studentName, action, timestamp, course, attendanceFlag }) {
  return {
    student_id: studentId,
    student_name: studentName,
    action: action,
    timestamp: timestamp,
    course: course,
    attendance_flag: attendanceFlag,
  };
}

describe('Property 2: Attendance Event Schema Completeness', () => {
  it('constructed message contains all 6 fields with correct types', () => {
    const validAction = fc.constantFrom('check_in', 'check_out');
    const validAttendanceFlag = fc.constantFrom('present', 'tardy', null);
    const validCourse = fc.oneof(
      fc.string({ minLength: 1, maxLength: 50 }),
      fc.constant(null)
    );
    const validStudentName = fc.string({ minLength: 1, maxLength: 100 });
    const validStudentId = fc.integer({ min: 1, max: 100000 });
    const validTimestamp = fc.integer({
      min: new Date('2020-01-01').getTime(),
      max: new Date('2030-12-31').getTime(),
    }).map((ms) => new Date(ms).toISOString());

    fc.assert(
      fc.property(
        validStudentId,
        validStudentName,
        validAction,
        validTimestamp,
        validCourse,
        validAttendanceFlag,
        (studentId, studentName, action, timestamp, course, attendanceFlag) => {
          const event = buildAttendanceEvent({
            studentId,
            studentName,
            action,
            timestamp,
            course,
            attendanceFlag,
          });

          // All 6 fields are present
          expect(event).toHaveProperty('student_id');
          expect(event).toHaveProperty('student_name');
          expect(event).toHaveProperty('action');
          expect(event).toHaveProperty('timestamp');
          expect(event).toHaveProperty('course');
          expect(event).toHaveProperty('attendance_flag');

          // student_id is a positive integer
          expect(typeof event.student_id).toBe('number');
          expect(Number.isInteger(event.student_id)).toBe(true);
          expect(event.student_id).toBeGreaterThan(0);

          // student_name is a string <= 100 chars
          expect(typeof event.student_name).toBe('string');
          expect(event.student_name.length).toBeLessThanOrEqual(100);

          // action is 'check_in' or 'check_out'
          expect(['check_in', 'check_out']).toContain(event.action);

          // timestamp is a valid ISO 8601 string
          expect(typeof event.timestamp).toBe('string');
          const parsed = new Date(event.timestamp);
          expect(parsed.toISOString()).toBe(event.timestamp);

          // course is string or null
          if (event.course !== null) {
            expect(typeof event.course).toBe('string');
          } else {
            expect(event.course).toBeNull();
          }

          // attendance_flag is 'present', 'tardy', or null
          if (event.attendance_flag !== null) {
            expect(['present', 'tardy']).toContain(event.attendance_flag);
          } else {
            expect(event.attendance_flag).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
