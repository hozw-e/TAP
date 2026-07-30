// Feature: realtime-anomaly-detection, Property 18: Trend Computation Correctness
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { computeTrend } from '../../components/AnomalyHistory.jsx';

/**
 * **Validates: Requirements 7.4**
 *
 * Trend computation must return:
 * - 'worsening' when recentAvg - priorAvg > 0.1
 * - 'improving' when recentAvg - priorAvg < -0.1
 * - 'stable' when |recentAvg - priorAvg| <= 0.1
 * - 'insufficient' when fewer than 2 alerts in last 4 weeks
 */

const PATTERN_TYPE = 'chronic_tardiness';

/**
 * Helper: create an alert at a specific date offset from now.
 */
function makeAlert(daysAgo, score, patternType = PATTERN_TYPE) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return {
    alert_id: Math.floor(Math.random() * 100000),
    student_id: 1,
    pattern_type: patternType,
    score,
    description: 'Test alert',
    detected_at: date.toISOString(),
  };
}

describe('Property 18: Trend Computation Correctness', () => {
  it('returns "worsening" when recentAvg - priorAvg > 0.1', () => {
    fc.assert(
      fc.property(
        // Prior period scores (15-28 days ago) - lower scores
        fc.array(fc.double({ min: 0.3, max: 0.5, noNaN: true }), { minLength: 1, maxLength: 5 }),
        // Recent period scores (0-13 days ago) - higher scores (diff > 0.1)
        fc.array(fc.double({ min: 0.7, max: 1.0, noNaN: true }), { minLength: 1, maxLength: 5 }),
        (priorScores, recentScores) => {
          const priorAvg = priorScores.reduce((s, v) => s + v, 0) / priorScores.length;
          const recentAvg = recentScores.reduce((s, v) => s + v, 0) / recentScores.length;

          // Only test cases where the diff is clearly > 0.1
          fc.pre(recentAvg - priorAvg > 0.1);

          const alerts = [
            ...priorScores.map((score, i) => makeAlert(15 + i, score)),
            ...recentScores.map((score, i) => makeAlert(1 + i, score)),
          ];

          const result = computeTrend(alerts, PATTERN_TYPE);
          expect(result.trend).toBe('worsening');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('returns "improving" when recentAvg - priorAvg < -0.1', () => {
    fc.assert(
      fc.property(
        // Prior period scores (15-28 days ago) - higher scores
        fc.array(fc.double({ min: 0.7, max: 1.0, noNaN: true }), { minLength: 1, maxLength: 5 }),
        // Recent period scores (0-13 days ago) - lower scores (diff < -0.1)
        fc.array(fc.double({ min: 0.3, max: 0.5, noNaN: true }), { minLength: 1, maxLength: 5 }),
        (priorScores, recentScores) => {
          const priorAvg = priorScores.reduce((s, v) => s + v, 0) / priorScores.length;
          const recentAvg = recentScores.reduce((s, v) => s + v, 0) / recentScores.length;

          // Only test cases where the diff is clearly < -0.1
          fc.pre(recentAvg - priorAvg < -0.1);

          const alerts = [
            ...priorScores.map((score, i) => makeAlert(15 + i, score)),
            ...recentScores.map((score, i) => makeAlert(1 + i, score)),
          ];

          const result = computeTrend(alerts, PATTERN_TYPE);
          expect(result.trend).toBe('improving');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('returns "stable" when |recentAvg - priorAvg| <= 0.1', () => {
    fc.assert(
      fc.property(
        // Base score that both periods will be close to
        fc.double({ min: 0.5, max: 0.8, noNaN: true }),
        // Small perturbation for prior (within 0.05 of base)
        fc.array(fc.double({ min: -0.03, max: 0.03, noNaN: true }), { minLength: 1, maxLength: 5 }),
        // Small perturbation for recent (within 0.05 of base)
        fc.array(fc.double({ min: -0.03, max: 0.03, noNaN: true }), { minLength: 1, maxLength: 5 }),
        (baseScore, priorPerturbs, recentPerturbs) => {
          const priorScores = priorPerturbs.map((p) => Math.max(0, Math.min(1, baseScore + p)));
          const recentScores = recentPerturbs.map((p) => Math.max(0, Math.min(1, baseScore + p)));

          const priorAvg = priorScores.reduce((s, v) => s + v, 0) / priorScores.length;
          const recentAvg = recentScores.reduce((s, v) => s + v, 0) / recentScores.length;

          // Only test cases where the diff is within stable range
          fc.pre(Math.abs(recentAvg - priorAvg) <= 0.1);

          const alerts = [
            ...priorScores.map((score, i) => makeAlert(15 + i, score)),
            ...recentScores.map((score, i) => makeAlert(1 + i, score)),
          ];

          const result = computeTrend(alerts, PATTERN_TYPE);
          expect(result.trend).toBe('stable');
        }
      ),
      { numRuns: 200 }
    );
  });

  it('returns "insufficient" when fewer than 2 alerts in last 4 weeks', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.5, max: 1.0, noNaN: true }),
        (score) => {
          // Only 1 alert in the last 4 weeks
          const alerts = [makeAlert(5, score)];
          const result = computeTrend(alerts, PATTERN_TYPE);
          expect(result.trend).toBe('insufficient');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns "insufficient" when no alerts exist for pattern type', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0.5, max: 1.0, noNaN: true }), { minLength: 2, maxLength: 10 }),
        (scores) => {
          // Alerts exist but for a different pattern type
          const alerts = scores.map((score, i) => makeAlert(i + 1, score, 'early_departure'));
          const result = computeTrend(alerts, PATTERN_TYPE);
          expect(result.trend).toBe('insufficient');
        }
      ),
      { numRuns: 100 }
    );
  });
});
