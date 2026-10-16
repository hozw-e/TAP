import { describe, it, expect } from 'vitest';
import { formatPatternType, getPatternIcon } from '../components/AnomalyToast.jsx';

describe('AnomalyToast - formatPatternType', () => {
  it('should format chronic_tardiness to "Chronic Tardiness"', () => {
    expect(formatPatternType('chronic_tardiness')).toBe('Chronic Tardiness');
  });

  it('should format attendance_dropoff to "Attendance Dropoff"', () => {
    expect(formatPatternType('attendance_dropoff')).toBe('Attendance Dropoff');
  });

  it('should format course_delay to "Course Delay"', () => {
    expect(formatPatternType('course_delay')).toBe('Course Delay');
  });

  it('should return empty string for null or undefined', () => {
    expect(formatPatternType(null)).toBe('');
    expect(formatPatternType(undefined)).toBe('');
  });

  it('should handle single word pattern types', () => {
    expect(formatPatternType('tardiness')).toBe('Tardiness');
  });
});

describe('AnomalyToast - getPatternIcon', () => {
  it('should return clock icon for chronic_tardiness', () => {
    expect(getPatternIcon('chronic_tardiness')).toBe('fas fa-clock');
  });

  it('should return chart icon for attendance_dropoff', () => {
    expect(getPatternIcon('attendance_dropoff')).toBe('fas fa-chart-line-down');
  });

  it('should return hourglass icon for course_delay', () => {
    expect(getPatternIcon('course_delay')).toBe('fas fa-hourglass-half');
  });

  it('should return default warning icon for unknown pattern types', () => {
    expect(getPatternIcon('unknown_type')).toBe('fas fa-exclamation-triangle');
  });
});
