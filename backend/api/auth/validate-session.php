<?php
/**
 * WebSocket Token Validation Endpoint
 *
 * GET /api/auth/validate-session.php?token=<ws_token>
 * (legacy ?session_id=<ws_token> is still accepted)
 *
 * Used by the Node.js WebSocket server to validate the opaque WebSocket token
 * presented by a browser on connect and during periodic re-checks (every 60s).
 *
 * This no longer loads a PHP session by ID. Instead it looks the token up in
 * the ws_tokens table (populated by /api/auth/ws-token.php), so the raw PHP
 * session ID is never exposed to JavaScript, URLs, or logs.
 *
 * Returns:
 *   200 { "valid": true, "admin_id": <id>, "admin_name": "<name>" }
 *   401 { "valid": false }
 */

require_once '../../utils/cors.php';
require_once '../../config/database.php';
require_once '../../utils/session.php';

header('Content-Type: application/json');

// Only accept GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['valid' => false, 'error' => 'Method not allowed']);
    exit();
}

// Accept the token under either param name for compatibility.
$token = $_GET['token'] ?? $_GET['session_id'] ?? null;

if (empty($token)) {
    http_response_code(401);
    echo json_encode(['valid' => false]);
    exit();
}

$conn = getDBConnection();
if (!$conn) {
    http_response_code(500);
    echo json_encode(['valid' => false, 'error' => 'Database connection failed']);
    exit();
}

$admin = validateWsToken($conn, $token);

if ($admin !== null) {
    http_response_code(200);
    echo json_encode([
        'valid' => true,
        'admin_id' => $admin['admin_id'],
        'admin_name' => $admin['admin_name'],
    ]);
} else {
    http_response_code(401);
    echo json_encode(['valid' => false]);
}

exit();
?>
