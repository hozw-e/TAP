-- Enable the MySQL Event Scheduler
SET GLOBAL event_scheduler = ON;

-- ═══════════════════════════════════════════════════════════════════
-- Event: Auto-close student attendance sessions at midnight
-- Runs daily at 00:00, closes any open sessions from that same day
-- (students who checked in but never tapped out)
-- ═══════════════════════════════════════════════════════════════════
DROP EVENT IF EXISTS auto_close_student_sessions;

CREATE EVENT auto_close_student_sessions
ON SCHEDULE EVERY 1 DAY
STARTS CONCAT(CURDATE() + INTERVAL 1 DAY, ' 00:00:00')
ON COMPLETION PRESERVE
ENABLE
DO
  UPDATE attendance_logs
  SET time_out = '23:59:59',
      auto_closed = 1
  WHERE date = CURDATE() - INTERVAL 1 DAY
    AND time_in IS NOT NULL
    AND time_out IS NULL;

-- ═══════════════════════════════════════════════════════════════════
-- Event: Auto-close visitor sessions at 5 PM
-- Runs daily at 17:00, closes any open visitor sessions from today
-- and releases their linked NFC tags
-- ═══════════════════════════════════════════════════════════════════
DROP EVENT IF EXISTS auto_close_visitor_sessions;

DELIMITER $$

CREATE EVENT auto_close_visitor_sessions
ON SCHEDULE EVERY 1 DAY
STARTS CONCAT(CURDATE() + INTERVAL 1 DAY, ' 17:00:00')
ON COMPLETION PRESERVE
ENABLE
DO
BEGIN
  -- Close open visitor sessions
  UPDATE visitors
  SET time_out = '17:00:00'
  WHERE date_of_visit = CURDATE()
    AND time_in IS NOT NULL
    AND time_out IS NULL;

  -- Release NFC tags linked to closed visitor sessions from today
  UPDATE nfc_tags
  SET visitor_session_id = NULL
  WHERE visitor_session_id IN (
    SELECT visit_id FROM visitors
    WHERE date_of_visit = CURDATE()
      AND time_out IS NOT NULL
  );
END$$

DELIMITER ;
