<?php
/**
 * Database Configuration
 * 
 * INSTRUCTIONS FOR SETUP:
 * 1. Open XAMPP Control Panel
 * 2. Start Apache and MySQL
 * 3. Update the values below to match your setup
 */

// Database connection settings
define('DB_HOST', 'localhost');     // Usually 'localhost' for XAMPP
define('DB_NAME', 'apdc_attendance'); // Change this to your database name
define('DB_USER', 'root');          // Default XAMPP MySQL username
define('DB_PASS', '');              // Default XAMPP MySQL password (empty)

// Create database connection
function getDBConnection() {
    try {
        $conn = new PDO(
            "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false
            ]
        );
        return $conn;
    } catch (PDOException $e) {
        // Log error and return null
        error_log("Database Connection Error: " . $e->getMessage());
        return null;
    }
}

// Test database connection (optional - can be called to verify setup)
function testConnection() {
    $conn = getDBConnection();
    if ($conn) {
        return [
            'success' => true,
            'message' => 'Database connection successful'
        ];
    } else {
        return [
            'success' => false,
            'message' => 'Database connection failed'
        ];
    }
}
?>
