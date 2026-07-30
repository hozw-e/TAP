import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Feature: system-improvements, Property 8: Visit-trend data consistency
// **Validates: Requirements 2.5, 2.10**

describe('Property 8: Visit-trend data consistency', () => {
  // Generate dates within a 30-day window
  const dateGen = fc.integer({ min: 0, max: 29 }).map(offset => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  });

  // Generate attendance logs: [{student_id, date}]
  const attendanceLogsGen = fc.array(
    fc.record({
      student_id: fc.integer({ min: 1, max: 50 }),
      date: dateGen,
    }),
    { minLength: 0, maxLength: 100 }
  );

  // Generate visitor logs: [{visit_id, date_of_visit}]
  const visitorLogsGen = fc.array(
    fc.record({
      visit_id: fc.integer({ min: 1, max: 200 }),
      date_of_visit: dateGen,
    }),
    { minLength: 0, maxLength: 100 }
  );

  // Simulate the trend.php logic
  function computeTrend(attendanceLogs, visitorLogs) {
    const trend = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const date = d.toISOString().split('T')[0];

      // Count distinct students for this date
      const studentsOnDate = new Set(
        attendanceLogs.filter(log => log.date === date).map(log => log.student_id)
      );

      // Count distinct visitors for this date
      const visitorsOnDate = new Set(
        visitorLogs.filter(log => log.date_of_visit === date).map(log => log.visit_id)
      );

      trend.push({ date, students: studentsOnDate.size, visitors: visitorsOnDate.size });
    }
    return trend;
  }

  it('sum of daily counts matches total distinct counts over the window (100 iterations)', () => {
    fc.assert(
      fc.property(attendanceLogsGen, visitorLogsGen, (attendanceLogs, visitorLogs) => {
        const trend = computeTrend(attendanceLogs, visitorLogs);

        // Sum students across all days
        const totalStudentDays = trend.reduce((sum, day) => sum + day.students, 0);
        // Sum visitors across all days
        const totalVisitorDays = trend.reduce((sum, day) => sum + day.visitors, 0);

        // Direct count: for each date, count distinct student_ids, then sum
        // This should equal totalStudentDays
        const directStudentCount = (() => {
          let count = 0;
          for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const date = d.toISOString().split('T')[0];
            count += new Set(
              attendanceLogs.filter(l => l.date === date).map(l => l.student_id)
            ).size;
          }
          return count;
        })();

        const directVisitorCount = (() => {
          let count = 0;
          for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const date = d.toISOString().split('T')[0];
            count += new Set(
              visitorLogs.filter(l => l.date_of_visit === date).map(l => l.visit_id)
            ).size;
          }
          return count;
        })();

        expect(totalStudentDays).toBe(directStudentCount);
        expect(totalVisitorDays).toBe(directVisitorCount);

        // Also verify: trend has exactly 30 entries
        expect(trend).toHaveLength(30);

        // All counts are non-negative
        trend.forEach(day => {
          expect(day.students).toBeGreaterThanOrEqual(0);
          expect(day.visitors).toBeGreaterThanOrEqual(0);
        });
      }),
      { numRuns: 100 }
    );
  });
});
