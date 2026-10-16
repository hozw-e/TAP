-- Migration: Add "course delay" anomaly pattern and remove "early departure"
--
-- A course delay is a student who enrolled weeks ago but whose weekly
-- scheduled sessions are not being used up at the expected pace, so the course
-- is running behind its expected completion schedule. The academy caps each
-- course at 4 sessions (students.remaining_sessions, default 4), and
-- course_schedules defines how many times per week a course meets. If a student
-- should have consumed N sessions by now (given their weeks enrolled and weekly
-- cadence) but has consumed fewer, the course is behind schedule.
--
-- The "early departure" pattern is removed: students are not permitted to leave
-- before their session end time, so that pattern cannot occur in practice.
--
-- This migration:
--   1. Rewrites the anomaly_alerts.pattern_type ENUM: drops 'early_departure'
--      and adds 'course_delay'.
--   2. Clears out any historical early_departure alerts so the ENUM change is
--      safe (rows with the removed value would otherwise be invalid).
--   3. Swaps the per-pattern enable flag in anomaly_config:
--      drops early_departure_enabled, adds course_delay_enabled.

-- 1. Remove any existing early_departure alerts before narrowing the ENUM.
DELETE FROM anomaly_alerts WHERE pattern_type = 'early_departure';

-- 2. Rewrite the pattern_type ENUM (drop early_departure, add course_delay).
ALTER TABLE anomaly_alerts
  MODIFY COLUMN pattern_type
    ENUM(
      'chronic_tardiness',
      'attendance_dropoff',
      'irregular_timing',
      'course_delay'
    ) NOT NULL;

-- 3a. Add the new enable flag to the single-row config table.
ALTER TABLE anomaly_config
  ADD COLUMN course_delay_enabled BOOLEAN NOT NULL DEFAULT TRUE
    AFTER irregular_timing_enabled;

-- 3b. Drop the obsolete early_departure enable flag.
ALTER TABLE anomaly_config
  DROP COLUMN early_departure_enabled;
