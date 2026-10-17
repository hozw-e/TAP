-- Migration: Add the "scheduled absence" anomaly pattern
--
-- Introduces a schedule-aware detector that flags students who keep missing
-- the sessions their course is actually scheduled for. Unlike the existing
-- detectors, this one does NOT depend on an "absent" row ever being written to
-- attendance_logs. In this system a missed class leaves no row at all, so a
-- detector that only counts existing rows is blind to no-shows. The new
-- detector reconstructs the sessions that *should* have happened from
-- course_schedules (a weekly, day-of-week recurrence) and compares them against
-- the days the student actually checked in. It fires on a run of consecutive
-- missed scheduled sessions (default 2+) OR a high overall miss rate
-- (default 50%+).
--
-- PORTABILITY: The deployed MySQL server is older than 8.0.29, so
-- "ADD COLUMN IF NOT EXISTS" is NOT supported. The column is added directly;
-- if a given database already has it, the ALTER errors with "Duplicate column"
-- -- in that case simply skip step 2.
--
-- HOW TO RUN IN TABLEPLUS: run each numbered block below in order.

-- ============================================================
-- 1. Extend the pattern_type ENUM with the new scheduled_absence pattern.
--    Idempotent: MODIFY simply restates the full definition.
-- ============================================================
ALTER TABLE anomaly_alerts
  MODIFY COLUMN pattern_type
    ENUM(
      'chronic_tardiness',
      'attendance_dropoff',
      'course_delay',
      'ml_behavioral',
      'scheduled_absence'
    ) NOT NULL;

-- ============================================================
-- 2. Add the scheduled_absence enable flag (defaults to enabled).
--    Skip this statement if the column already exists ("Duplicate column").
-- ============================================================
ALTER TABLE anomaly_config
  ADD COLUMN scheduled_absence_enabled BOOLEAN NOT NULL DEFAULT TRUE;
