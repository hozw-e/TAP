-- Migration: Add session-based enrollment columns
-- Description: Adds remaining_sessions to students table and session_decremented to attendance_logs table
-- Requirements: 1.2, 2.3

-- Add remaining_sessions column to students table
-- Tracks how many attendance sessions a student has left (initialized to 4, decremented on each check-out)
ALTER TABLE students
ADD COLUMN remaining_sessions TINYINT UNSIGNED NOT NULL DEFAULT 4
  COMMENT 'Number of attendance sessions remaining (0-4). Decremented on check-out, initialized to 4 on creation.';

-- Add session_decremented column to attendance_logs table
-- Idempotency guard ensuring each attendance record can only cause one session decrement
ALTER TABLE attendance_logs
ADD COLUMN session_decremented BOOLEAN NOT NULL DEFAULT FALSE
  COMMENT 'Whether this attendance record has already triggered a session decrement. Prevents double-counting on retries or auto-close re-processing.';
