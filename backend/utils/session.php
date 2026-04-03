<?php
/**
 * Session Utility Functions
 */
 
/**
 * Check if admin is logged in
 */
/* function checkAdminSession() {
    // Start session if not already started
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    if (!isset($_SESSION['admin_logged_in']) || $_SESSION['admin_logged_in'] !== true) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Unauthorized. Please login first.'
        ]);
        exit();
    }
}  */

/**
 * Require admin authentication
 * Stops execution if admin is not logged in
 */

function isAdminLoggedIn() {
    // ✅ Always ensure session is active before reading $_SESSION
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }

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
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
    
    return [
        'admin_id' => $_SESSION['admin_id'] ?? null,
        'admin_name' => $_SESSION['admin_name'] ?? null,
        'username' => $_SESSION['username'] ?? null
    ];
}
 
/**
 * Set admin session
 */
function setAdminSession($adminData) {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }

    session_regenerate_id(true); // ✅ Prevent session fixation on login

    $_SESSION['admin_logged_in'] = true;
    $_SESSION['admin_id'] = $adminData['admin_id'];
    $_SESSION['admin_name'] = $adminData['admin_name'];
    $_SESSION['username'] = $adminData['username'];
}
 
/**
 * Clear admin session
 */
function clearAdminSession() {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }

    session_unset();
    session_destroy();

    // ✅ Prevent session fixation
    session_start();
    session_regenerate_id(true);
}

/* ------------------------- old code ------------------------- */
/**
 * Session Management Utility
 * Handles admin authentication and session tracking
 */





/**
 * Get current admin ID
 * @return int|null Admin ID or null if not logged in
 */
/* function getCurrentAdminId() {
    return $_SESSION['admin_id'] ?? null;
} */

/**
 * Get current admin username
 * @return string|null Admin username or null if not logged in
 */
/* function getCurrentAdminUsername() {
    return $_SESSION['admin_username'] ?? null;
} */

/**
 * Set admin session after successful login
 * @param int $adminId Admin ID
 * @param string $username Admin username
 */
/* function setAdminSession($adminId, $username, $adminName) {
    $_SESSION['admin_id'] = $adminId;
    $_SESSION['admin_username'] = $username;
    $_SESSION['admin_name'] = $adminName;
    $_SESSION['admin_logged_in'] = true;
    $_SESSION['login_time'] = time();
} */

/**
 * Destroy admin session (logout)
 */
/* function destroyAdminSession() {
    session_unset();
    session_destroy();
} */


?>
