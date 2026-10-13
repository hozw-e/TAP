-- ============================================================
-- Migration: 008_ws_tokens.sql
-- Description: Dedicated WebSocket authentication tokens.
--
--   Previously the raw PHP session ID was returned to the browser,
--   stored in sessionStorage, and passed in the WebSocket URL as a
--   query parameter — exposing it to JS, URLs, and logs.
--
--   This table backs an opaque, short-lived token the browser uses
--   to authenticate to the WebSocket server instead. The token is
--   minted by /api/auth/ws-token.php and validated (without touching
--   the PHP session) by /api/auth/validate-session.php. It is created
--   here only — the request handlers no longer create it at runtime.
--
--   Columns:
--     token      – 64-char hex, primary key (the opaque credential)
--     admin_id   – owning admin
--     admin_name – cached for the WS server's connection metadata
--     expires_at – hard TTL (default 2h; pruned opportunistically)
--     created_at – issuance time
-- ============================================================

CREATE TABLE IF NOT EXISTS ws_tokens (
    token      CHAR(64)     NOT NULL,
    admin_id   INT          NOT NULL,
    admin_name VARCHAR(255) NULL DEFAULT NULL,
    expires_at DATETIME     NOT NULL,
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (token),
    INDEX idx_expires (expires_at)
);
