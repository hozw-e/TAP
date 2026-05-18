<?php
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('DB_NAME') ?: 'apdc_attendance');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: '');
define('DB_PORT', getenv('DB_PORT') ?: '3306');

// Set PHP timezone to Asia/Manila
date_default_timezone_set('Asia/Manila');

function getDBConnection() {
    try {
        $conn = new PDO(
            'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8',
            DB_USER,
            DB_PASS
        );
        $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $conn->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        // Set MySQL session timezone to Asia/Manila (+08:00)
        $conn->exec("SET time_zone = '+08:00'");
        return $conn;
    } catch (PDOException $e) {
        error_log("DB Connection Error: " . $e->getMessage());
        return null;
    }
}
?>