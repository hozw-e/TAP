-- ============================================================
-- Migration: 009_runtime_tables.sql
-- Description: Promote tables that were previously created at runtime
--   (via CREATE TABLE IF NOT EXISTS inside request handlers) into a
--   proper migration. The runtime DDL has been removed from:
--     - api/auth/login.php      (login_attempts)
--     - api/nfc/set-mode.php     (scanner_mode)
--     - api/nfc/scan.php         (temp_nfc_scans + action_result column)
--
--   Running DDL on every request added overhead, required elevated DB
--   privileges at runtime, and scattered the schema across the codebase.
-- ============================================================

-- Per-IP login throttling (used by the login rate limiter).
CREATE TABLE IF NOT EXISTS login_attempts (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    ip_address   VARCHAR(45) NOT NULL,
    attempted_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ip_time (ip_address, attempted_at)
);

-- Single-row table holding the current NFC scanner mode
-- ('attendance' | 'assign' | 'visitor').
CREATE TABLE IF NOT EXISTS scanner_mode (
    id         INT PRIMARY KEY DEFAULT 1,
    mode       VARCHAR(20) NOT NULL DEFAULT 'attendance',
    updated_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed the single scanner_mode row so set-mode.php's upsert and scan.php's
-- read always have a row to work with.
INSERT INTO scanner_mode (id, mode)
VALUES (1, 'attendance')
ON DUPLICATE KEY UPDATE mode = mode;

-- Short-lived buffer of raw NFC scans the ESP32 writes and the frontend polls.
-- action_result holds the processed outcome written back by scan.php.
CREATE TABLE IF NOT EXISTS temp_nfc_scans (
    id            INT PRIMARY KEY AUTO_INCREMENT,
    uid           VARCHAR(100) NOT NULL,
    action_result JSON         DEFAULT NULL,
    scanned_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    consumed      BOOLEAN      DEFAULT FALSE,
    INDEX idx_consumed (consumed),
    INDEX idx_scanned_at (scanned_at)
);
