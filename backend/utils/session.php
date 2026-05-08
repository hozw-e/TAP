<?php
/**
 * Session Utility Functions
 */

// Configure session for cross-domain use on Railway
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_samesite', 'None');
    ini_set('session.cookie_secure', '1');
    ini_set('session.cookie_httponly', '1');
    session_start();
}

function isAdminLoggedIn() {
    return isset($_SESSION['admin_id']) 
        && isset($_SESSION['admin_logged_in']) 
        && $_SESSION['admin_logged_in'] === true;
}

function requireAdminAuth() {
    // ✅ isAdminLoggedIn() now handles session start internally
    if (!isAdminLoggedIn()) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Unauthorized. Admin must be logged in.'
        ]);
        exit();
    }
}

/**
 * Get current admin info
 */
function getAdminInfo() {
    return [
        'admin_id'   => $_SESSION['admin_id']   ?? null,
        'admin_name' => $_SESSION['admin_name'] ?? null,
        'username'   => $_SESSION['username']   ?? null
    ];
}
 
/**
 * Set admin session
 */
function setAdminSession($adminData) {
    session_regenerate_id(true);

    $_SESSION['admin_logged_in'] = true;
    $_SESSION['admin_id']        = $adminData['admin_id'];
    $_SESSION['admin_name']      = $adminData['admin_name'];
    $_SESSION['username']        = $adminData['username'];
}
 
/**
 * Clear admin session
 */
function clearAdminSession() {
    session_unset();
    session_destroy();
    session_start();
    session_regenerate_id(true);
}

?>