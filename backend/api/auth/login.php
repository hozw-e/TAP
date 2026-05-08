<?php
require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/session.php';
require_once '../../utils/activity-logger.php';

// Get JSON input
$data = json_decode(file_get_contents('php://input'), true);

// Validate input
if (empty($data['username']) || empty($data['password'])) {
    sendErrorResponse('Username and password are required');
}

$username = $data['username'];
$password = $data['password'];

try {
    $conn = getDBConnection();

    if (!$conn) {
        sendErrorResponse('Database connection failed');
    }

    // Get admin by username
    $stmt = $conn->prepare("SELECT * FROM admins WHERE username = :username");
    $stmt->execute([':username' => $username]);
    $admin = $stmt->fetch();

    if (!$admin) {
        sendErrorResponse('Invalid username or password');
    }

    // Verify hashed password
    if (!password_verify($password, $admin['password'])) {
        sendErrorResponse('Invalid username or password');
    }

    // Set session using utility
    setAdminSession([
        'admin_id'   => $admin['admin_id'],
        'admin_name' => $admin['admin_name'],
        'username'   => $admin['username'],
    ]);

    // Log the login activity
    logActivity(
        'LOGIN',
        'ADMIN',
        $admin['admin_name'],
        'Admin logged in successfully',
        $admin['admin_name']
    );

    sendSuccessResponse('Login successful', [
        'admin_id'   => $admin['admin_id'],
        'admin_name' => $admin['admin_name'],
        'username'   => $admin['username'],
    ]);

} catch (PDOException $e) {
    error_log("Login error: " . $e->getMessage());
    sendErrorResponse('Login failed');
}
?>