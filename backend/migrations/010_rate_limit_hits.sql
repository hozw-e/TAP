-- ============================================================
-- Migration: 010_rate_limit_hits.sql
-- Description: Backing table for the generic per-IP rate limiter
--   (backend/utils/rate-limit.php), used to throttle public endpoints
--   such as the NFC scan channel. Promoted out of the runtime
--   CREATE TABLE IF NOT EXISTS that previously lived in the limiter.
-- ============================================================

CREATE TABLE IF NOT EXISTS rate_limit_hits (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    bucket     VARCHAR(64) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    hit_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_bucket_ip_time (bucket, ip_address, hit_at)
);
