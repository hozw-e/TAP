-- ============================================================
-- Migration: 001_system_improvements.sql
-- Description: Schema changes for system improvements feature
-- ============================================================

-- ============================================================
-- New table: course_schedules
-- Requirement: 4.1 - Admin-managed weekly course schedules
-- ============================================================
CREATE TABLE IF NOT EXISTS course_schedules (
  schedule_id  INT          NOT NULL AUTO_INCREMENT,
  course_name  ENUM(
    'Basic Coding','Research','EV3','Rover 2','AI Steam',
    'Arduino','IoT','Python Programming','Robotics'
  ) NOT NULL,
  day_of_week  ENUM('Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday') NOT NULL,
  start_time   TIME         NOT NULL,
  end_time     TIME         NOT NULL,
  grace_period TINYINT UNSIGNED NOT NULL DEFAULT 15
    CHECK (grace_period BETWEEN 0 AND 120),
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (schedule_id),
  INDEX idx_course_day (course_name, day_of_week)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- New table: notification_logs
-- Requirement: 1.6 - Persist delivery outcome for every notification attempt
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_logs (
  notif_id     INT          NOT NULL AUTO_INCREMENT,
  guardian_id  INT          NULL,
  student_id   INT          NULL,
  event_type   ENUM('check_in','check_out') NOT NULL,
  channel      ENUM('messenger','viber') NOT NULL,
  status       ENUM('SENT','FAILED') NOT NULL,
  error_detail VARCHAR(255) NULL,
  sent_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notif_id),
  KEY fk_notif_guardian (guardian_id),
  KEY fk_notif_student  (student_id),
  CONSTRAINT fk_notif_guardian FOREIGN KEY (guardian_id)
    REFERENCES guardians (guardian_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_notif_student  FOREIGN KEY (student_id)
    REFERENCES students  (student_id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
