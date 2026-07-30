-- ============================================================
-- Migration: 005_course_total_hours.sql
-- Description: Add total_hours column to course_schedules and
--              seed existing courses with their hour requirements.
-- Requirements: 1.1, 8.1, 8.2, 8.3, 8.4
-- ============================================================

-- ============================================================
-- Step 1: Add total_hours column (idempotent)
-- Uses a procedure to check if column already exists before adding.
-- ============================================================
DROP PROCEDURE IF EXISTS add_total_hours_column;

DELIMITER //
CREATE PROCEDURE add_total_hours_column()
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'course_schedules'
      AND COLUMN_NAME = 'total_hours'
  ) THEN
    ALTER TABLE course_schedules
    ADD COLUMN total_hours DECIMAL(4,1) DEFAULT NULL
      COMMENT 'Total hours required across all 4 sessions. NULL means no hour enforcement.';
  END IF;
END //
DELIMITER ;

CALL add_total_hours_column();
DROP PROCEDURE IF EXISTS add_total_hours_column;

-- ============================================================
-- Step 2: Seed total_hours for existing courses (idempotent)
-- Uses UPDATE with WHERE clause — skips courses that don't exist.
-- Running multiple times produces the same result.
-- Requirements: 8.1, 8.3, 8.4
-- ============================================================
UPDATE course_schedules SET total_hours = 12.0 WHERE course_name = 'Basic Coding';
UPDATE course_schedules SET total_hours = 6.0  WHERE course_name = 'Research';
UPDATE course_schedules SET total_hours = 12.0 WHERE course_name = 'EV3';
UPDATE course_schedules SET total_hours = 12.0 WHERE course_name = 'Rover 2';
UPDATE course_schedules SET total_hours = 12.0 WHERE course_name = 'AI Steam';
UPDATE course_schedules SET total_hours = 12.0 WHERE course_name = 'Arduino';
UPDATE course_schedules SET total_hours = 12.0 WHERE course_name = 'IoT';
UPDATE course_schedules SET total_hours = 12.0 WHERE course_name = 'Python Programming';
UPDATE course_schedules SET total_hours = 12.0 WHERE course_name = 'Robotics';

-- ============================================================
-- Step 3: Recompute end_time for seeded courses (idempotent)
-- Sets end_time = start_time + (total_hours / 4) hours for all
-- records that have a non-NULL start_time and non-NULL total_hours.
-- Requirements: 8.2, 8.3
-- ============================================================
UPDATE course_schedules
SET end_time = ADDTIME(start_time, SEC_TO_TIME((total_hours / 4) * 3600))
WHERE total_hours IS NOT NULL
  AND start_time IS NOT NULL;
