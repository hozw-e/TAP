import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

describe('anomaly/deduplicator', () => {
  let deduplicator;

  beforeEach(() => {
    deduplicator = require('../src/anomaly/deduplicator.js');
    deduplicator.clear();
  });

  it('allows first broadcast for a student/pattern combination', () => {
    const alert = {
      student_id: 1,
      pattern_type: 'chronic_tardiness',
      detected_at: '2024-01-15T10:00:00Z',
    };
    expect(deduplicator.shouldBroadcast(alert)).toBe(true);
  });

  it('suppresses duplicate within 24 hours', () => {
    // Use timestamps relative to "now" so the deduplication logic works correctly
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000).toISOString();

    const alert1 = {
      student_id: 1,
      pattern_type: 'chronic_tardiness',
      detected_at: fiveMinutesAgo,
    };
    const alert2 = {
      student_id: 1,
      pattern_type: 'chronic_tardiness',
      detected_at: twoMinutesAgo,
    };

    expect(deduplicator.shouldBroadcast(alert1)).toBe(true);
    expect(deduplicator.shouldBroadcast(alert2)).toBe(false);
  });

  it('allows broadcast after 24 hours have passed', () => {
    const alert1 = {
      student_id: 1,
      pattern_type: 'chronic_tardiness',
      detected_at: '2024-01-15T10:00:00Z',
    };

    expect(deduplicator.shouldBroadcast(alert1)).toBe(true);

    // Advance Date.now() by 25 hours
    const originalNow = Date.now;
    Date.now = () => new Date('2024-01-16T11:00:01Z').getTime();

    const alert2 = {
      student_id: 1,
      pattern_type: 'chronic_tardiness',
      detected_at: '2024-01-16T11:00:00Z',
    };
    expect(deduplicator.shouldBroadcast(alert2)).toBe(true);

    Date.now = originalNow;
  });

  it('allows different pattern types for the same student', () => {
    const alert1 = {
      student_id: 1,
      pattern_type: 'chronic_tardiness',
      detected_at: '2024-01-15T10:00:00Z',
    };
    const alert2 = {
      student_id: 1,
      pattern_type: 'attendance_dropoff',
      detected_at: '2024-01-15T10:00:00Z',
    };

    expect(deduplicator.shouldBroadcast(alert1)).toBe(true);
    expect(deduplicator.shouldBroadcast(alert2)).toBe(true);
  });

  it('allows same pattern type for different students', () => {
    const alert1 = {
      student_id: 1,
      pattern_type: 'chronic_tardiness',
      detected_at: '2024-01-15T10:00:00Z',
    };
    const alert2 = {
      student_id: 2,
      pattern_type: 'chronic_tardiness',
      detected_at: '2024-01-15T10:00:00Z',
    };

    expect(deduplicator.shouldBroadcast(alert1)).toBe(true);
    expect(deduplicator.shouldBroadcast(alert2)).toBe(true);
  });

  it('tracks size correctly', () => {
    expect(deduplicator.size()).toBe(0);

    deduplicator.shouldBroadcast({
      student_id: 1,
      pattern_type: 'chronic_tardiness',
      detected_at: '2024-01-15T10:00:00Z',
    });
    expect(deduplicator.size()).toBe(1);

    deduplicator.shouldBroadcast({
      student_id: 2,
      pattern_type: 'attendance_dropoff',
      detected_at: '2024-01-15T10:00:00Z',
    });
    expect(deduplicator.size()).toBe(2);
  });

  it('clear removes all entries', () => {
    deduplicator.shouldBroadcast({
      student_id: 1,
      pattern_type: 'chronic_tardiness',
      detected_at: '2024-01-15T10:00:00Z',
    });
    expect(deduplicator.size()).toBe(1);

    deduplicator.clear();
    expect(deduplicator.size()).toBe(0);
  });
});
