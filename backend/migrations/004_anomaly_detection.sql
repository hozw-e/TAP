-- Migration: Create anomaly detection tables
-- Adds anomaly_alerts for persisting detected attendance anomalies
-- Adds anomaly_config for single-row detection configuration

-- ============================================================
-- Table: anomaly_alerts
-- Stores all generated anomaly alerts for historical tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS anomaly_alerts (
  alert_id       INT          NOT NULL AUTO_INCREMENT,
  student_id     INT          NOT NULL,
  pattern_type   ENUM('chronic_tardiness', 'attendance_dropoff', 'irregular_timing', 'early_departure') NOT NULL,
  score          DECIMAL(3,2) NOT NULL CHECK (score >= 0.00 AND score <= 1.00),
  description    VARCHAR(500) NOT NULL,
  detected_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (alert_id),
  INDEX idx_student_pattern (student_id, pattern_type),
  INDEX idx_detected_at (detected_at),
  INDEX idx_student_date (student_id, detected_at),
  CONSTRAINT fk_alert_student FOREIGN KEY (student_id)
    REFERENCES students (student_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Table: anomaly_config
-- Stores anomaly detection configuration (single row)
-- ============================================================
CREATE TABLE IF NOT EXISTS anomaly_config (
  config_id               INT          NOT NULL DEFAULT 1,
  alert_threshold         DECIMAL(3,2) NOT NULL DEFAULT 0.70 CHECK (alert_threshold >= 0.50 AND alert_threshold <= 1.00),
  historical_window_days  TINYINT UNSIGNED NOT NULL DEFAULT 30 CHECK (historical_window_days >= 7 AND historical_window_days <= 90),
  chronic_tardiness_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  attendance_dropoff_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  irregular_timing_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  early_departure_enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (config_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default configuration (threshold=0.70, window=30, all patterns enabled)
INSERT INTO anomaly_config (config_id) VALUES (1)
  ON DUPLICATE KEY UPDATE config_id = config_id;
