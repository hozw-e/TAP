-- ============================================================
-- Migration: 002_visitor_checkout.sql
-- Description: Add visitor checkout support
--   - Add time_out column to visitors table
--   - Add visitor_session_id column to nfc_tags table
-- ============================================================

-- 1. Add time_out column to visitors (allows recording when a visitor leaves)
ALTER TABLE visitors
  ADD COLUMN time_out TIME DEFAULT NULL AFTER time_in;

-- 2. Add visitor_session_id to nfc_tags (links a tag to an active visitor session)
ALTER TABLE nfc_tags
  ADD COLUMN visitor_session_id INT DEFAULT NULL AFTER assigned_at;

-- ! NOT YET IMPORTED TO TABLEPLUS !