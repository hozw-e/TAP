-- ============================================================
-- Migration: 007_msg_channel_sms.sql
-- Description: Add SMS notification tracking columns and
--   attendance_flag to attendance_logs.
--
--   The live table was missing these columns entirely, so all
--   notification UPDATEs in scan.php silently failed and the
--   dashboard always displayed N/A for every SMS column.
--
--   New columns:
--     msg_channel     – channel used for check-in SMS ('sms'|'email'|'push')
--     msg_success     – 1 = sent, 0 = failed, NULL = not attempted
--     msg_out_channel – channel used for check-out SMS
--     msg_out_success – 1 = sent, 0 = failed, NULL = not attempted
--     attendance_flag – on-time / late / very_late etc. (set at check-in)
-- ============================================================

ALTER TABLE attendance_logs
  ADD COLUMN msg_channel     ENUM('sms','email','push') NULL DEFAULT NULL,
  ADD COLUMN msg_success     TINYINT(1)                 NULL DEFAULT NULL,
  ADD COLUMN msg_out_channel ENUM('sms','email','push') NULL DEFAULT NULL,
  ADD COLUMN msg_out_success TINYINT(1)                 NULL DEFAULT NULL,
  ADD COLUMN attendance_flag VARCHAR(20)                NULL DEFAULT NULL;
