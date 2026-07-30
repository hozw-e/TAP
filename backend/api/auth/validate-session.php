<?php
/**
 * Session Validation Endpoint for WebSocket Server
 * 
 * GET /api/auth/validate-session.php?session_id=<token>
 * 
 * Used by the Node.js WebSocket server to validate PHP session tokens
 * on connection and during periodic re-checks (every 60s).
 * 
 * Returns:
 *   200 { "valid": true, "admin_id": <id>, "admin_name": "<name>" }
 *   401 { "valid": false }
 */

require_once '../../utils/cors.php';

header('Content-Type: application/json');

// Only accept GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['valid' => false, 'error' => 'Method not allowed']);
    exit();
}

// Get session_id from query parameter
$sessionId = $_GET['session_id'] ?? null;

if (empty($sessionId)) {
    http_response_code(401);
    echo json_encode(['valid' => false]);
    exit();
}

// Validate the session_id format (PHP session IDs are alphanumeric + comma + dash)
if (!preg_match('/^[a-zA-Z0-9,\-]{22,256}$/', $sessionId)) {
    http_response_code(401);
    echo json_encode(['valid' => false]);
    exit();
}

// Set the session ID from the query parameter before starting the session
session_id($sessionId);
session_start();

// Check if the session contains valid admin data
$isValid = isset($_SESSION['admin_logged_in']) 
    && $_SESSION['admin_logged_in'] === true
    && isset($_SESSION['admin_id']);

if ($isValid) {
    http_response_code(200);
    echo json_encode([
        'valid' => true,
        'admin_id' => $_SESSION['admin_id'],
        'admin_name' => $_SESSION['admin_name'] ?? null
    ]);
} else {
    http_response_code(401);
    echo json_encode(['valid' => false]);
}

// Close the session without modifying it
session_abort();
exit();
?>
