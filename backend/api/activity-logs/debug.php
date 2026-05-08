<?php
header('Content-Type: application/json');
require_once '../../utils/cors.php';

// Start session
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_samesite', 'None');
    ini_set('session.cookie_secure', '1');
    ini_set('session.cookie_httponly', '1');
    session_start();
}

// Debug information
$debug = [
    'session_id' => session_id(),
    'session_data' => $_SESSION,
    'cookies' => $_COOKIE,
    'headers' => getallheaders(),
    'origin' => $_SERVER['HTTP_ORIGIN'] ?? 'not set',
    'session_status' => session_status(),
    'is_logged_in' => isset($_SESSION['admin_id']) && isset($_SESSION['admin_logged_in']),
];

echo json_encode([
    'success' => true,
    'debug' => $debug
], JSON_PRETTY_PRINT);
?>
