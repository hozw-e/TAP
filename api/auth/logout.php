<?php
/**
 * Admin Logout API
 * POST /api/auth/logout.php
 */

require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/session.php';

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed', 405);
}

// Destroy session
destroyAdminSession();

sendSuccess(null, 'Logout successful');
?>
