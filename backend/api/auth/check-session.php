<?php
require_once '../../utils/cors.php';
require_once '../../utils/response.php';

// Start session
session_start();

$isLoggedIn = isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;

if ($isLoggedIn) {
    sendSuccessResponse('Session active', [
        'logged_in' => true,
        'admin_id' => $_SESSION['admin_id'] ?? null,
        'admin_name' => $_SESSION['admin_name'] ?? null,
        'username' => $_SESSION['username'] ?? null
    ]);
} else {
    sendSuccessResponse('No active session', [
        'logged_in' => false
    ]);
}
?>