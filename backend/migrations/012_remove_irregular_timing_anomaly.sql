-- Migration: Remove the "irregular timing" anomaly pattern
--
-- Irregular timing flagged check-ins whose time-of-day deviated sharply from a
-- student's historical average. This is now redundant: check-in/check-out are
-- gated at scan time to the scheduled class window (start_time - 60min .. end_time),
-- so an accepted check-in can no longer land at an arbitrary hour. The only
-- alerts it still produced were noise from pre-restriction legacy records, so
-- the pattern is being retired.
--
-- This migration:
--   1. Deletes historical irregular_timing alerts (including the stale
--      pre-restriction ones) so the ENUM change is safe and they stop
--      appearing in the history view.
--   2. Rewrites the anomaly_alerts.pattern_type ENUM to drop 'irregular_timing'.
--   3. Drops the irregular_timing_enabled flag from anomaly_config.

-- 1. Remove any existing irregular_timing alerts before narrowing the ENUM.
DELETE FROM anomaly_alerts WHERE pattern_type = 'irregular_timing';

-- 2. Rewrite the pattern_type ENUM (drop irregular_timing).
ALTER TABLE anomaly_alerts
  MODIFY COLUMN pattern_type
    ENUM(
      'chronic_tardiness',
      'attendance_dropoff',
      'course_delay'
    ) NOT NULL;

-- 3. Drop the obsolete irregular_timing enable flag.
ALTER TABLE anomaly_config
  DROP COLUMN irregular_timing_enabled;
