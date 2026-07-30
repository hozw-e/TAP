import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Feature: system-improvements, Property 5: Absent flag completeness at end-of-day
// **Validates: Requirements 4.8**

describe('Property 5: Absent flag completeness', () => {
  const courses = ['Basic Coding', 'Research', 'EV3', 'Rover 2', 'AI Steam', 'Arduino', 'IoT', 'Python Programming', 'Robotics'];

  /**
   * Port of the PHP computeAbsentees() function.
   * Returns student_ids that should be flagged absent.
   *
   * A student entry is absent if:
   * - Their course is in the scheduled courses for today
   * - They do NOT have an existing attendance log for today
   *
   * Note: the PHP function iterates all student rows, so duplicate student_ids
   * with the same qualifying course will appear multiple times in the output.
   */
  function computeAbsentees(students, scheduledCourses, existingLogStudentIds) {
    const loggedSet = new Set(existingLogStudentIds);
    const scheduledSet = new Set(scheduledCourses);

    return students
      .filter(s => scheduledSet.has(s.course) && !loggedSet.has(s.student_id))
      .map(s => s.student_id);
  }

  it('flags exactly the students whose course is scheduled today and who have no attendance record', () => {
    fc.assert(
      fc.property(
        // Generate students
        fc.array(
          fc.record({
            student_id: fc.integer({ min: 1, max: 100 }),
            course: fc.constantFrom(...courses),
          }),
          { minLength: 0, maxLength: 30 }
        ),
        // Generate scheduled courses for today (subset of all courses)
        fc.shuffledSubarray(courses, { minLength: 0, maxLength: courses.length }),
        // Generate existing log student_ids (some students already have records)
        fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 0, maxLength: 20 }),
        (students, scheduledCourses, existingLogStudentIds) => {
          const result = computeAbsentees(students, scheduledCourses, existingLogStudentIds);

          const loggedSet = new Set(existingLogStudentIds);
          const scheduledSet = new Set(scheduledCourses);

          // Compute the expected result independently
          const expected = students
            .filter(s => scheduledSet.has(s.course) && !loggedSet.has(s.student_id))
            .map(s => s.student_id);

          // ASSERTION 1: Every student_id in the result should belong to a student
          // whose course is scheduled AND who has no attendance record
          for (const studentId of result) {
            expect(students.some(s => s.student_id === studentId)).toBe(true);
            expect(loggedSet.has(studentId)).toBe(false);
          }

          // ASSERTION 2: Completeness — the result contains every expected absent student_id
          // Every student whose course is scheduled and has no log must appear
          const expectedSet = new Set(expected);
          const resultSet = new Set(result);
          for (const expectedId of expectedSet) {
            expect(resultSet.has(expectedId)).toBe(true);
          }

          // ASSERTION 3: No extra students — result contains no student_ids that shouldn't be there
          for (const id of resultSet) {
            expect(expectedSet.has(id)).toBe(true);
          }

          // ASSERTION 4: The set of unique student_ids in result matches exactly
          // the set of unique expected-absent student_ids
          expect(resultSet).toEqual(expectedSet);
        }
      ),
      { numRuns: 100 }
    );
  });
});
