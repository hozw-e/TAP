<?php
/**
 * Device Authentication Utility
 *
 * Protects the public NFC scan endpoint (called by the ESP32 reader) with a
 * shared secret. The device sends the secret in the X-Device-Secret header;
 * the server compares it against NFC_DEVICE_SECRET using a constant-time check.
 *
 * Behaviour:
 *   - If NFC_DEVICE_SECRET is empty (typical local XAMPP dev), the check is
 *     skipped so development isn't blocked. A notice is logged once so the gap
 *     is visible in logs.
 *   - If NFC_DEVICE_SECRET is set (production), a missing or mismatched header
 *     is rejected with HTTP 401 and the request stops.
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/response.php';

/**
 * Enforce device authentication for the NFC scan channel.
 *
 * Must be called before any state-changing work in the handler.
 */
function requireDeviceAuth() {
    $configuredSecret = defined('NFC_DEVICE_SECRET') ? NFC_DEVICE_SECRET : '';

    // No secret configured → dev mode, allow through but make it visible.
    if ($configuredSecret === '') {
        error_log('requireDeviceAuth: NFC_DEVICE_SECRET is not set — device authentication is DISABLED.');
        return;
    }

    // Header is normalized by PHP to HTTP_X_DEVICE_SECRET.
    $provided = $_SERVER['HTTP_X_DEVICE_SECRET'] ?? '';

    if ($provided === '' || !hash_equals($configuredSecret, $provided)) {
        error_log('requireDeviceAuth: rejected scan — missing/invalid device secret from ' . ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
        sendErrorResponse('Unauthorized device', 401);
    }
}
?>
