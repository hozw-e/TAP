import { describe, it, expect } from 'vitest';
import { sortAlerts, insertAlertSorted, isDuplicate } from './useAnomalyAlerts.js';

describe('sortAlerts', () => {
  it('sorts by score descending', () => {
    const alerts = [
      { student_id: 1, student_name: 'Alice', pattern_type: 'chronic_tardiness', score: 0.7, description: 'test', detected_at: '2024-01-01T10:00:00Z' },
      { student_id: 2, student_name: 'Bob', pattern_type: 'attendance_dropoff', score: 0.9, description: 'test', detected_at: '2024-01-01T10:00:00Z' },
      { student_id: 3, student_name: 'Charlie', pattern_type: 'irregular_timing', score: 0.8, description: 'test', detected_at: '2024-01-01T10:00:00Z' },
    ];

    const sorted = sortAlerts(alerts);
    expect(sorted[0].score).toBe(0.9);
    expect(sorted[1].score).toBe(0.8);
    expect(sorted[2].score).toBe(0.7);
  });

  it('breaks ties by detected_at descending', () => {
    const alerts = [
      { student_id: 1, student_name: 'Alice', pattern_type: 'chronic_tardiness', score: 0.8, description: 'test', detected_at: '2024-01-01T08:00:00Z' },
      { student_id: 2, student_name: 'Bob', pattern_type: 'attendance_dropoff', score: 0.8, description: 'test', detected_at: '2024-01-01T12:00:00Z' },
      { student_id: 3, student_name: 'Charlie', pattern_type: 'irregular_timing', score: 0.8, description: 'test', detected_at: '2024-01-01T10:00:00Z' },
    ];

    const sorted = sortAlerts(alerts);
    expect(sorted[0].student_name).toBe('Bob');       // 12:00
    expect(sorted[1].student_name).toBe('Charlie');   // 10:00
    expect(sorted[2].student_name).toBe('Alice');     // 08:00
  });

  it('returns empty array for empty input', () => {
    expect(sortAlerts([])).toEqual([]);
  });

  it('does not mutate original array', () => {
    const alerts = [
      { student_id: 1, student_name: 'Alice', pattern_type: 'chronic_tardiness', score: 0.7, description: 'test', detected_at: '2024-01-01T10:00:00Z' },
      { student_id: 2, student_name: 'Bob', pattern_type: 'attendance_dropoff', score: 0.9, description: 'test', detected_at: '2024-01-01T10:00:00Z' },
    ];
    const original = [...alerts];
    sortAlerts(alerts);
    expect(alerts).toEqual(original);
  });
});

describe('insertAlertSorted', () => {
  it('inserts alert in correct position by score', () => {
    const existing = [
      { student_id: 1, student_name: 'High', pattern_type: 'chronic_tardiness', score: 0.95, description: 'test', detected_at: '2024-01-01T10:00:00Z' },
      { student_id: 2, student_name: 'Low', pattern_type: 'attendance_dropoff', score: 0.72, description: 'test', detected_at: '2024-01-01T10:00:00Z' },
    ];

    const newAlert = { student_id: 3, student_name: 'Mid', pattern_type: 'irregular_timing', score: 0.85, description: 'test', detected_at: '2024-01-01T10:00:00Z' };
    const result = insertAlertSorted(existing, newAlert);

    expect(result.length).toBe(3);
    expect(result[0].student_name).toBe('High');
    expect(result[1].student_name).toBe('Mid');
    expect(result[2].student_name).toBe('Low');
  });

  it('inserts at beginning when score is highest', () => {
    const existing = [
      { student_id: 1, student_name: 'A', pattern_type: 'chronic_tardiness', score: 0.8, description: 'test', detected_at: '2024-01-01T10:00:00Z' },
    ];
    const newAlert = { student_id: 2, student_name: 'B', pattern_type: 'attendance_dropoff', score: 0.95, description: 'test', detected_at: '2024-01-01T10:00:00Z' };
    const result = insertAlertSorted(existing, newAlert);

    expect(result[0].student_name).toBe('B');
  });

  it('inserts at end when score is lowest', () => {
    const existing = [
      { student_id: 1, student_name: 'A', pattern_type: 'chronic_tardiness', score: 0.9, description: 'test', detected_at: '2024-01-01T10:00:00Z' },
    ];
    const newAlert = { student_id: 2, student_name: 'B', pattern_type: 'attendance_dropoff', score: 0.7, description: 'test', detected_at: '2024-01-01T10:00:00Z' };
    const result = insertAlertSorted(existing, newAlert);

    expect(result[1].student_name).toBe('B');
  });

  it('breaks ties by detected_at descending', () => {
    const existing = [
      { student_id: 1, student_name: 'Earlier', pattern_type: 'chronic_tardiness', score: 0.85, description: 'test', detected_at: '2024-01-01T08:00:00Z' },
    ];
    const newAlert = { student_id: 2, student_name: 'Later', pattern_type: 'attendance_dropoff', score: 0.85, description: 'test', detected_at: '2024-01-01T12:00:00Z' };
    const result = insertAlertSorted(existing, newAlert);

    expect(result[0].student_name).toBe('Later');
    expect(result[1].student_name).toBe('Earlier');
  });

  it('caps at MAX_ALERTS (100)', () => {
    const existing = Array.from({ length: 100 }, (_, i) => ({
      student_id: i,
      student_name: `Student ${i}`,
      pattern_type: 'chronic_tardiness',
      score: 0.9 - i * 0.001,
      description: 'test',
      detected_at: '2024-01-01T10:00:00Z',
    }));

    const newAlert = { student_id: 999, student_name: 'New', pattern_type: 'attendance_dropoff', score: 0.95, description: 'test', detected_at: '2024-01-01T10:00:00Z' };
    const result = insertAlertSorted(existing, newAlert);

    expect(result.length).toBe(100);
    expect(result[0].student_name).toBe('New');
  });

  it('does not mutate original array', () => {
    const existing = [
      { student_id: 1, student_name: 'A', pattern_type: 'chronic_tardiness', score: 0.9, description: 'test', detected_at: '2024-01-01T10:00:00Z' },
    ];
    const original = [...existing];
    insertAlertSorted(existing, { student_id: 2, student_name: 'B', pattern_type: 'attendance_dropoff', score: 0.8, description: 'test', detected_at: '2024-01-01T10:00:00Z' });
    expect(existing).toEqual(original);
  });
});

describe('isDuplicate', () => {
  it('returns true when same student_id and pattern_type exist', () => {
    const existing = [
      { student_id: 1, student_name: 'Alice', pattern_type: 'chronic_tardiness', score: 0.8, description: 'test', detected_at: '2024-01-01T10:00:00Z' },
    ];
    const newAlert = { student_id: 1, student_name: 'Alice', pattern_type: 'chronic_tardiness', score: 0.9, description: 'updated', detected_at: '2024-01-01T12:00:00Z' };

    expect(isDuplicate(existing, newAlert)).toBe(true);
  });

  it('returns false when student_id differs', () => {
    const existing = [
      { student_id: 1, student_name: 'Alice', pattern_type: 'chronic_tardiness', score: 0.8, description: 'test', detected_at: '2024-01-01T10:00:00Z' },
    ];
    const newAlert = { student_id: 2, student_name: 'Bob', pattern_type: 'chronic_tardiness', score: 0.9, description: 'test', detected_at: '2024-01-01T12:00:00Z' };

    expect(isDuplicate(existing, newAlert)).toBe(false);
  });

  it('returns false when pattern_type differs', () => {
    const existing = [
      { student_id: 1, student_name: 'Alice', pattern_type: 'chronic_tardiness', score: 0.8, description: 'test', detected_at: '2024-01-01T10:00:00Z' },
    ];
    const newAlert = { student_id: 1, student_name: 'Alice', pattern_type: 'attendance_dropoff', score: 0.7, description: 'test', detected_at: '2024-01-01T12:00:00Z' };

    expect(isDuplicate(existing, newAlert)).toBe(false);
  });

  it('returns false for empty existing list', () => {
    const newAlert = { student_id: 1, student_name: 'Alice', pattern_type: 'chronic_tardiness', score: 0.8, description: 'test', detected_at: '2024-01-01T10:00:00Z' };
    expect(isDuplicate([], newAlert)).toBe(false);
  });
});
