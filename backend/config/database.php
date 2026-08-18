<?php
/**
 * Load .env.local (and .env as fallback) for local XAMPP development.
 * PHP does not auto-load .env files — getenv() only reads system/process env vars.
 * This loader is only triggered when the variable is not already set in the environment
 * (e.g. on Railway/Docker, real env vars take precedence).
 */
if (getenv('SMSAPIPH_API_KEY') === false || getenv('SMSAPIPH_API_KEY') === '') {
    $envFiles = [
        __DIR__ . '/../../.env.local',
        __DIR__ . '/../../.env',
    ];
    foreach ($envFiles as $envFile) {
        if (!file_exists($envFile)) {
            continue;
        }
        $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            // Skip comments and lines without '='
            if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) {
                continue;
            }
            [$name, $value] = explode('=', $line, 2);
            $name  = trim($name);
            $value = trim($value);
            // Only set if not already defined in the real environment
            if ($name !== '' && getenv($name) === false) {
                putenv("$name=$value");
            }
        }
        break; // Stop after the first file found (.env.local wins over .env)
    }
}

define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('DB_NAME') ?: 'apdc_attendance');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: '');
define('DB_PORT', getenv('DB_PORT') ?: '3306');

// SMS API PH - Free SMS API for Philippine numbers
define('SMSAPIPH_API_KEY', getenv('SMSAPIPH_API_KEY') ?: '');

// Legacy: IProgSMS token (no longer used, replaced by SMS API PH)
// define('SMS_API_TOKEN', getenv('SMS_API_TOKEN') ?: '');

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