<?php
require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/session.php';
require_once '../../utils/activity-logger.php';

// Get admin name before destroying session
$adminName = isset($_SESSION['admin_name']) ? $_SESSION['admin_name'] : 'Unknown';

// Log the logout activity
logActivity(
    'LOGOUT',
    'ADMIN',
    $adminName,
    'Admin logged out',
    $adminName
);

// Clear session using utility
clearAdminSession();

sendSuccessResponse('Logged out successfully');
?>
 