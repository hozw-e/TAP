// Feature: realtime-anomaly-detection, Property 14: Duplicate Suppression Within 24 Hours
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const PATTERN_TYPES = [
  'chronic_tardiness',
  'attendance_dropoff',
  'irregular_timing',
  'early_departure',
];

describe('Property 14: Duplicate Suppression Within 24 Hours', () => {
  let deduplicator;
  let originalDateNow;

  beforeEach(() => {
    deduplicator = require('../../src/anomaly/deduplicator.js');
    deduplicator.clear();
    originalDateNow = Date.now;
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  /**
   * Validates: Requirements 4.6
   *
   * Property: First alert for any student+pattern combination is always broadcast.
   */
  it('first alert for any student+pattern is always broadcast', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.constantFrom(...PATTERN_TYPES),
        (studentId, patternType) => {
          deduplicator.clear();

          const alert = {
            student_id: studentId,
            pattern_type: patternType,
            detected_at: new Date().toISOString(),
          };

          expect(deduplicator.shouldBroadcast(alert)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 4.6
   *
   * Property: Second alert with same student_id+pattern_type within 24h is suppressed.
   */
  it('second alert with same student_id+pattern_type within 24h is suppressed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.constantFrom(...PATTERN_TYPES),
        fc.integer({ min: 1, max: 23 * 60 * 60 * 1000 }), // offset within 24h (1ms to ~23h in ms)
        (studentId, patternType, offsetMs) => {
          deduplicator.clear();

          const baseTime = new Date('2024-06-15T12:00:00Z').getTime();

          // First alert
          const alert1 = {
            student_id: studentId,
            pattern_type: patternType,
            detected_at: new Date(baseTime).toISOString(),
          };

          // Set Date.now to be at baseTime so the first alert is recent
          Date.now = () => baseTime;
          expect(deduplicator.shouldBroadcast(alert1)).toBe(true);

          // Second alert within 24h
          const secondTime = baseTime + offsetMs;
          Date.now = () => secondTime;

          const alert2 = {
            student_id: studentId,
            pattern_type: patternType,
            detected_at: new Date(secondTime).toISOString(),
          };

          expect(deduplicator.shouldBroadcast(alert2)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 4.6
   *
   * Property: Second alert with same student_id+pattern_type after 24h is broadcast.
   */
  it('second alert with same student_id+pattern_type after 24h is broadcast', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.constantFrom(...PATTERN_TYPES),
        fc.integer({ min: 1, max: 48 * 60 * 60 * 1000 }), // extra offset beyond 24h (1ms to 48h)
        (studentId, patternType, extraOffsetMs) => {
          deduplicator.clear();

          const baseTime = new Date('2024-06-15T12:00:00Z').getTime();
          const twentyFourHoursMs = 24 * 60 * 60 * 1000;

          // First alert
          const alert1 = {
            student_id: studentId,
            pattern_type: patternType,
            detected_at: new Date(baseTime).toISOString(),
          };

          Date.now = () => baseTime;
          expect(deduplicator.shouldBroadcast(alert1)).toBe(true);

          // Second alert after 24h
          const laterTime = baseTime + twentyFourHoursMs + extraOffsetMs;
          Date.now = () => laterTime;

          const alert2 = {
            student_id: studentId,
            pattern_type: patternType,
            detected_at: new Date(laterTime).toISOString(),
          };

          expect(deduplicator.shouldBroadcast(alert2)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Validates: Requirements 4.6
   *
   * Property: Different student_id OR different pattern_type is never suppressed
   * by another alert.
   */
  it('different student_id or pattern_type is never suppressed by another alert', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 1, max: 10000 }),
        fc.constantFrom(...PATTERN_TYPES),
        fc.constantFrom(...PATTERN_TYPES),
        (studentId1, studentId2, patternType1, patternType2) => {
          // Only test when at least one of student_id or pattern_type differs
          fc.pre(studentId1 !== studentId2 || patternType1 !== patternType2);

          deduplicator.clear();

          const now = new Date().toISOString();

          // Broadcast first alert
          const alert1 = {
            student_id: studentId1,
            pattern_type: patternType1,
            detected_at: now,
          };
          deduplicator.shouldBroadcast(alert1);

          // Second alert with different key should always be broadcast
          const alert2 = {
            student_id: studentId2,
            pattern_type: patternType2,
            detected_at: now,
          };

          expect(deduplicator.shouldBroadcast(alert2)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
