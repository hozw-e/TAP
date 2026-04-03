<?php
require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
 
// Start session
session_start();
 
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
    
    // Verify password (plain text comparison for now)
    if ($password !== $admin['password']) {
        sendErrorResponse('Invalid username or password');
    }
    
    // Set session
    $_SESSION['admin_logged_in'] = true;
    $_SESSION['admin_id'] = $admin['admin_id'];
    $_SESSION['admin_name'] = $admin['admin_name'];
    $_SESSION['username'] = $admin['username'];
    
    sendSuccessResponse('Login successful', [
        'admin_id' => $admin['admin_id'],
        'admin_name' => $admin['admin_name'],
        'username' => $admin['username']
    ]);
    
} catch (PDOException $e) {
    error_log("Login error: " . $e->getMessage());
    sendErrorResponse('Login failed');
}
?>