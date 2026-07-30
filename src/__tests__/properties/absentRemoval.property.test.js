// Feature: realtime-anomaly-detection, Property 5: Check-In Removes Student from Absent List
// **Validates: Requirements 2.5**

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Pure logic: removes a student from the absent list by student_id.
 * Returns the filtered list with the checked-in student removed.
 */
function removeFromAbsentList(absentList, checkedInStudentId) {
  return absentList.filter(s => s.student_id !== checkedInStudentId);
}

describe('Property 5: Check-In Removes Student from Absent List', () => {
  const studentArb = fc.record({
    student_id: fc.integer({ min: 1, max: 100000 }),
    student_name: fc.string({ minLength: 1, maxLength: 100 }),
  });

  const absentListArb = fc.array(studentArb, { minLength: 0, maxLength: 30 })
    .map(students => {
      // Ensure unique student_ids in the absent list
      const seen = new Set();
      return students.filter(s => {
        if (seen.has(s.student_id)) return false;
        seen.add(s.student_id);
        return true;
      });
    });

  it('checked-in student is NOT in the result list', () => {
    fc.assert(
      fc.property(
        absentListArb,
        fc.integer({ min: 1, max: 100000 }),
        (absentList, checkedInId) => {
          const result = removeFromAbsentList(absentList, checkedInId);
          const found = result.find(s => s.student_id === checkedInId);
          expect(found).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('all other students remain in the result list', () => {
    fc.assert(
      fc.property(
        absentListArb,
        fc.integer({ min: 1, max: 100000 }),
        (absentList, checkedInId) => {
          const result = removeFromAbsentList(absentList, checkedInId);
          const otherStudents = absentList.filter(s => s.student_id !== checkedInId);
          expect(result).toEqual(otherStudents);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('order is preserved for remaining students', () => {
    fc.assert(
      fc.property(
        absentListArb,
        fc.integer({ min: 1, max: 100000 }),
        (absentList, checkedInId) => {
          const result = removeFromAbsentList(absentList, checkedInId);
          // Verify order: each element in result appears in the same relative order as in original
          let lastIndex = -1;
          for (const student of result) {
            const originalIndex = absentList.findIndex(s => s.student_id === student.student_id);
            expect(originalIndex).toBeGreaterThan(lastIndex);
            lastIndex = originalIndex;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('removing a student that exists in the list decreases length by 1', () => {
    fc.assert(
      fc.property(
        absentListArb.filter(list => list.length > 0),
        (absentList) => {
          // Pick a student that is actually in the list
          const target = absentList[0];
          const result = removeFromAbsentList(absentList, target.student_id);
          expect(result.length).toBe(absentList.length - 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('removing a student NOT in the list does not change the list', () => {
    fc.assert(
      fc.property(
        absentListArb,
        (absentList) => {
          // Use an ID guaranteed not in the list
          const maxId = absentList.reduce((max, s) => Math.max(max, s.student_id), 0);
          const nonExistentId = maxId + 1;
          const result = removeFromAbsentList(absentList, nonExistentId);
          expect(result).toEqual(absentList);
        }
      ),
      { numRuns: 100 }
    );
  });
});
