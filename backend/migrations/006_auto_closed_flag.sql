-- ============================================================
-- Migration: 006_auto_closed_flag.sql
-- Description: Add auto_closed flag to attendance_logs
--   - auto_closed = 1 means the session was force-closed by
--     the midnight auto-close job (student forgot to tap out).
--   - Allows the frontend to display "No Time Out" status even
--     though a real time_out value (23:59:59) exists on the row.
-- ============================================================

ALTER TABLE attendance_logs
  ADD COLUMN auto_closed TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = closed by midnight auto-close job; 0 = normal tap-out'
  AFTER time_out;
