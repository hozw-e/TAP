<?php
/**
 * Session Management Utility
 * Handles admin authentication and session tracking
 */

// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/**
 * Check if admin is logged in
 * @return bool True if logged in, false otherwise
 */
function isAdminLoggedIn() {
    return isset($_SESSION['admin_id']) && isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;
}

/**
 * Get current admin ID
 * @return int|null Admin ID or null if not logged in
 */
function getCurrentAdminId() {
    return $_SESSION['admin_id'] ?? null;
}

/**
 * Get current admin username
 * @return string|null Admin username or null if not logged in
 */
function getCurrentAdminUsername() {
    return $_SESSION['admin_username'] ?? null;
}

/**
 * Set admin session after successful login
 * @param int $adminId Admin ID
 * @param string $username Admin username
 */
function setAdminSession($adminId, $username, $adminName) {
    $_SESSION['admin_id'] = $adminId;
    $_SESSION['admin_username'] = $username;
    $_SESSION['admin_name'] = $adminName;
    $_SESSION['admin_logged_in'] = true;
    $_SESSION['login_time'] = time();
}

/**
 * Destroy admin session (logout)
 */
function destroyAdminSession() {
    session_unset();
    session_destroy();
}

/**
 * Require admin authentication
 * Stops execution if admin is not logged in
 */
function requireAdminAuth() {
    if (!isAdminLoggedIn()) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Unauthorized. Admin must be logged in.'
        ]);
        exit();
    }
}
?>
