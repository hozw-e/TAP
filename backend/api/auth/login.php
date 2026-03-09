<?php
/**
 * Admin Login API
 * POST /api/auth/login.php
 * 
 * Request Body:
 * {
 *   "username": "admin",
 *   "password": "password123"
 * }
 */

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/session.php';

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendError('Method not allowed', 405);
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Validate required fields
$missingFields = validateRequiredFields($input, ['username', 'password']);
if ($missingFields) {
    sendError('Missing required fields: ' . implode(', ', $missingFields), 400);
}

$username = trim($input['username']);
$password = $input['password'];

// Get database connection
$conn = getDBConnection();
if (!$conn) {
    sendError('Database connection failed', 500);
}

try {
    // Query admin by username
    $stmt = $conn->prepare("SELECT admin_id, admin_name, username, password FROM admins WHERE username = :username");
    $stmt->execute(['username' => $username]);
    $admin = $stmt->fetch();
    
    if (!$admin) {
        sendError('Invalid username or password', 401);
    }
    
    // Verify password
    // NOTE: For production, use password_hash() when creating admin and password_verify() here
    // For now, we'll do plain text comparison (CHANGE THIS LATER!)
    if ($password !== $admin['password']) {
        sendError('Invalid username or password', 401);
    }
    
    // Set session
    setAdminSession($admin['admin_id'], $admin['username'], $admin['admin_name']);
    
    // Return success with admin info
    sendSuccess([
        'admin_id' => $admin['admin_id'],
        'admin_name' => $admin['admin_name'],
        'username' => $admin['username']
    ], 'Login successful');
    
} catch (PDOException $e) {
    error_log("Login Error: " . $e->getMessage());
    sendError('Login failed', 500);
}
?>
