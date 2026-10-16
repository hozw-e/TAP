-- Migration: Add the "ML behavioral" anomaly pattern
--
-- Introduces an unsupervised machine-learning detector (Isolation Forest) that
-- learns a multivariate model of normal student behavior from the whole cohort
-- and flags students whose combined behavioral profile is a statistical
-- outlier. Unlike the three rule-based detectors (chronic_tardiness,
-- attendance_dropoff, course_delay), which fire on hand-tuned thresholds over a
-- single metric, this detector's decision boundary is learned from the data at
-- run time.
--
-- SELF-HEALING: On the deployed database the anomaly_config table only has
-- chronic_tardiness_enabled and attendance_dropoff_enabled -- migration 011
-- never added course_delay_enabled. This migration ensures BOTH the missing
-- course_delay_enabled flag AND the new ml_behavioral_enabled flag exist.
--
-- PORTABILITY: The deployed MySQL server is older than 8.0.29, so
-- "ADD COLUMN IF NOT EXISTS" is NOT supported. Instead each column is added
-- conditionally by building an ALTER statement from an INFORMATION_SCHEMA check
-- and running it as a prepared statement -- no DELIMITER / stored procedure
-- required, so this pastes and runs cleanly in TablePlus (one block at a time).
--
-- HOW TO RUN IN TABLEPLUS: run each numbered block below in order. Blocks 2 and
-- 3 are multi-statement (SET / PREPARE / EXECUTE / DEALLOCATE) -- select the
-- whole block and run it together.

-- ============================================================
-- 0. Remove rows holding retired pattern values before narrowing the ENUM.
--    Migrations 011/012 were supposed to delete these, but did not fully
--    apply on the deployed DB, leaving e.g. 'irregular_timing' rows that make
--    the ENUM MODIFY in step 1 fail with "Data truncated". These come from
--    detectors that no longer exist, so deleting them is the intended cleanup.
-- ============================================================
DELETE FROM anomaly_alerts
  WHERE pattern_type IN ('irregular_timing', 'early_departure');

-- ============================================================
-- 1. Extend the pattern_type ENUM with the new ML pattern.
--    Idempotent: MODIFY simply restates the full definition. Safe only after
--    step 0 has removed any out-of-list values.
-- ============================================================
ALTER TABLE anomaly_alerts
  MODIFY COLUMN pattern_type
    ENUM(
      'chronic_tardiness',
      'attendance_dropoff',
      'course_delay',
      'ml_behavioral'
    ) NOT NULL;

-- ============================================================
-- 2. Repair the course_delay flag that migration 011 failed to add.
--    The deployed anomaly_config only had chronic_tardiness_enabled and
--    attendance_dropoff_enabled, so this column is added directly. If a given
--    database already has it, this statement errors with "Duplicate column" --
--    in that case simply skip it.
-- ============================================================
ALTER TABLE anomaly_config
  ADD COLUMN course_delay_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- ============================================================
-- 3. Add the ML enable flag (defaults to enabled).
--    As above, skip this statement if the column already exists.
-- ============================================================
ALTER TABLE anomaly_config
  ADD COLUMN ml_behavioral_enabled BOOLEAN NOT NULL DEFAULT TRUE;
