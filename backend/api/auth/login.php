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

    // --- Rate limiting: max 5 failed attempts per IP in 15 minutes ---
    $clientIP = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

    // Create login_attempts table if it doesn't exist
    $conn->exec("
        CREATE TABLE IF NOT EXISTS login_attempts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ip_address VARCHAR(45) NOT NULL,
            attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_ip_time (ip_address, attempted_at)
        )
    ");

    // Clean up old attempts (older than 15 minutes)
    $conn->exec("DELETE FROM login_attempts WHERE attempted_at < DATE_SUB(NOW(), INTERVAL 15 MINUTE)");

    // Count recent failed attempts from this IP
    $stmtAttempts = $conn->prepare("
        SELECT COUNT(*) as attempt_count 
        FROM login_attempts 
        WHERE ip_address = :ip AND attempted_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)
    ");
    $stmtAttempts->execute([':ip' => $clientIP]);
    $attemptRow = $stmtAttempts->fetch(PDO::FETCH_ASSOC);
    $attemptCount = (int)($attemptRow['attempt_count'] ?? 0);

    if ($attemptCount >= 5) {
        sendErrorResponse('Too many failed login attempts. Please try again in 15 minutes.', 429);
    }

    // Get admin by username
    $stmt = $conn->prepare("SELECT * FROM admins WHERE username = :username");
    $stmt->execute([':username' => $username]);
    $admin = $stmt->fetch();

    if (!$admin || !password_verify($password, $admin['password'])) {
        // Record failed attempt
        $stmtRecord = $conn->prepare("INSERT INTO login_attempts (ip_address, attempted_at) VALUES (:ip, NOW())");
        $stmtRecord->execute([':ip' => $clientIP]);

        sendErrorResponse('Invalid username or password');
    }

    // Successful login — clear failed attempts for this IP
    $stmtClear = $conn->prepare("DELETE FROM login_attempts WHERE ip_address = :ip");
    $stmtClear->execute([':ip' => $clientIP]);

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
