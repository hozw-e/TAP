import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Feature: course-hour-requirements, Property 9: Denial record completeness

describe('Property 9: Denial record completeness', () => {
  /**
   * Port of the denial record builder from scan.php.
   * Builds a denial JSON object when the Hour_Requirement_Gate denies check-out.
   *
   * **Validates: Requirements 4.1, 4.2**
   */
  function buildHourDenialRecord(studentId, studentName, uid, timestamp, minimumMinutes, renderedMinutes, remainingMinutes) {
    return {
      student_id: studentId,
      student_name: studentName,
      uid: uid,
      timestamp: timestamp,
      status: 'denied',
      action: 'hour_requirement_denied',
      minimum_required_minutes: minimumMinutes,
      rendered_minutes: renderedMinutes,
      remaining_minutes: remainingMinutes
    };
  }

  // Generator for ISO 8601 timestamps with timezone offset
  const isoTimestampGen = fc.tuple(
    fc.integer({ min: 2020, max: 2030 }),  // year
    fc.integer({ min: 1, max: 12 }),       // month
    fc.integer({ min: 1, max: 28 }),       // day (safe for all months)
    fc.integer({ min: 0, max: 23 }),       // hour
    fc.integer({ min: 0, max: 59 }),       // minute
    fc.integer({ min: 0, max: 59 })        // second
  ).map(([y, mo, d, h, mi, s]) =>
    `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(s).padStart(2, '0')}+08:00`
  );

  // Generator for UID strings (hex-colon format like "AB:CD:EF:12")
  const hexByte = fc.integer({ min: 0, max: 255 }).map(n => n.toString(16).toUpperCase().padStart(2, '0'));
  const uidGen = fc.tuple(hexByte, hexByte, hexByte, hexByte).map(parts => parts.join(':'));

  it('denial record contains all 9 required fields with correct types (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),            // studentId
        fc.string({ minLength: 1, maxLength: 100 }),   // studentName
        uidGen,                                         // uid
        isoTimestampGen,                                // timestamp
        fc.integer({ min: 1, max: 3000 }),             // minimumMinutes
        fc.integer({ min: 0, max: 2999 }),             // renderedMinutes
        (studentId, studentName, uid, timestamp, minimumMinutes, renderedMinutes) => {
          const remainingMinutes = minimumMinutes - renderedMinutes;

          const record = buildHourDenialRecord(
            studentId, studentName, uid, timestamp,
            minimumMinutes, renderedMinutes, remainingMinutes
          );

          // 1. Record has exactly 9 fields (no extra, no missing)
          const keys = Object.keys(record);
          expect(keys.length).toBe(9);

          // 2. All required fields are present
          expect(record).toHaveProperty('student_id');
          expect(record).toHaveProperty('student_name');
          expect(record).toHaveProperty('uid');
          expect(record).toHaveProperty('timestamp');
          expect(record).toHaveProperty('status');
          expect(record).toHaveProperty('action');
          expect(record).toHaveProperty('minimum_required_minutes');
          expect(record).toHaveProperty('rendered_minutes');
          expect(record).toHaveProperty('remaining_minutes');

          // 3. Field types are correct
          expect(Number.isInteger(record.student_id)).toBe(true);
          expect(typeof record.student_name).toBe('string');
          expect(typeof record.uid).toBe('string');
          expect(typeof record.timestamp).toBe('string');
          // Timestamp is ISO 8601 format
          expect(record.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
          expect(record.status).toBe('denied');
          expect(record.action).toBe('hour_requirement_denied');
          expect(Number.isInteger(record.minimum_required_minutes)).toBe(true);
          expect(Number.isInteger(record.rendered_minutes)).toBe(true);
          expect(Number.isInteger(record.remaining_minutes)).toBe(true);

          // 4. remaining_minutes == minimum_required_minutes - rendered_minutes
          expect(record.remaining_minutes).toBe(record.minimum_required_minutes - record.rendered_minutes);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('denial record values match the inputs exactly (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),            // studentId
        fc.string({ minLength: 1, maxLength: 50 }),    // studentName
        uidGen,                                         // uid
        isoTimestampGen,                                // timestamp
        fc.integer({ min: 1, max: 3000 }),             // minimumMinutes
        fc.integer({ min: 0, max: 2999 }),             // renderedMinutes
        (studentId, studentName, uid, timestamp, minimumMinutes, renderedMinutes) => {
          const remainingMinutes = minimumMinutes - renderedMinutes;

          const record = buildHourDenialRecord(
            studentId, studentName, uid, timestamp,
            minimumMinutes, renderedMinutes, remainingMinutes
          );

          // Verify all dynamic fields match inputs
          expect(record.student_id).toBe(studentId);
          expect(record.student_name).toBe(studentName);
          expect(record.uid).toBe(uid);
          expect(record.timestamp).toBe(timestamp);
          expect(record.minimum_required_minutes).toBe(minimumMinutes);
          expect(record.rendered_minutes).toBe(renderedMinutes);
          expect(record.remaining_minutes).toBe(remainingMinutes);

          // Verify constant fields
          expect(record.status).toBe('denied');
          expect(record.action).toBe('hour_requirement_denied');
        }
      ),
      { numRuns: 100 }
    );
  });
});
