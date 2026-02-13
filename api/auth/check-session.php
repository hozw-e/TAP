<?php
/**
 * Check Admin Session API
 * GET /api/auth/check-session.php
 * 
 * Returns current session status
 */

require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/session.php';

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendError('Method not allowed', 405);
}

if (isAdminLoggedIn()) {
    sendSuccess([
        'logged_in' => true,
        'admin_id' => getCurrentAdminId(),
        'admin_username' => getCurrentAdminUsername()
    ], 'Admin is logged in');
} else {
    sendSuccess([
        'logged_in' => false
    ], 'No active session');
}
?>
