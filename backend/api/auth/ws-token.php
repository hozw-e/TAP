<?php
/**
 * WebSocket Token Endpoint
 * GET /api/auth/ws-token.php
 *
 * Issues a short-lived, opaque token the browser uses to authenticate to the
 * WebSocket server. This replaces the previous practice of handing the raw PHP
 * session ID to JavaScript. Requires an active admin session (cookie-based).
 *
 * Returns:
 *   200 { "success": true, "data": { "ws_token": "<64-hex>", "expires_at": "Y-m-d H:i:s" } }
 */

require_once '../../utils/cors.php';
require_once '../../config/database.php';
require_once '../../utils/response.php';
require_once '../../utils/session.php';

// Must be an authenticated admin.
requireAdminAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendErrorResponse('Method not allowed', 405);
}

try {
    $conn = getDBConnection();
    if (!$conn) {
        sendErrorResponse('Database connection failed', 500);
    }

    $ws = issueWsToken($conn);

    sendSuccessResponse('WebSocket token issued', [
        'ws_token'   => $ws['token'],
        'expires_at' => $ws['expires_at'],
    ]);
} catch (PDOException $e) {
    error_log('ws-token error: ' . $e->getMessage());
    sendErrorResponse('Failed to issue WebSocket token', 500);
}
?>
