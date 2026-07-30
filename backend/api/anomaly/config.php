<?php
require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/session.php';

header('Content-Type: application/json');

// Require admin authentication
requireAdminAuth();

$engineUrl = getenv('ANOMALY_ENGINE_URL') ?: 'http://localhost:5000';
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    // Forward GET request to Python engine
    $ch = curl_init($engineUrl . '/config');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 2,
        CURLOPT_CONNECTTIMEOUT => 2,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false || $curlError) {
        http_response_code(503);
        echo json_encode([
            'success' => false,
            'message' => 'Anomaly engine is unavailable'
        ]);
        exit();
    }

    http_response_code($httpCode);
    echo $response;
    exit();

} elseif ($method === 'PUT') {
    // Read and parse JSON body
    $rawBody = file_get_contents('php://input');
    $data = json_decode($rawBody, true);

    if ($data === null) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid JSON body'
        ]);
        exit();
    }

    // Validate input fields
    $errors = [];
    $validPatterns = ['chronic_tardiness', 'attendance_dropoff', 'irregular_timing', 'early_departure'];

    // Validate alert_threshold
    if (isset($data['alert_threshold'])) {
        if (!is_numeric($data['alert_threshold'])) {
            $errors[] = 'alert_threshold must be numeric';
        } elseif ($data['alert_threshold'] < 0.5 || $data['alert_threshold'] > 1.0) {
            $errors[] = 'alert_threshold must be between 0.5 and 1.0';
        }
    }

    // Validate historical_window_days
    if (isset($data['historical_window_days'])) {
        if (!is_int($data['historical_window_days'])) {
            $errors[] = 'historical_window_days must be an integer';
        } elseif ($data['historical_window_days'] < 7 || $data['historical_window_days'] > 90) {
            $errors[] = 'historical_window_days must be between 7 and 90';
        }
    }

    // Validate enabled_patterns
    if (isset($data['enabled_patterns'])) {
        if (!is_array($data['enabled_patterns'])) {
            $errors[] = 'enabled_patterns must be an array';
        } else {
            foreach ($data['enabled_patterns'] as $pattern) {
                if (!in_array($pattern, $validPatterns, true)) {
                    $errors[] = "Invalid pattern type: $pattern";
                }
            }
        }
    }

    // Return validation errors if any
    if (!empty($errors)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Validation failed',
            'errors' => $errors
        ]);
        exit();
    }

    // Forward PUT request to Python engine
    $ch = curl_init($engineUrl . '/config');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => 'PUT',
        CURLOPT_POSTFIELDS => $rawBody,
        CURLOPT_TIMEOUT => 2,
        CURLOPT_CONNECTTIMEOUT => 2,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Accept: application/json'
        ],
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false || $curlError) {
        http_response_code(503);
        echo json_encode([
            'success' => false,
            'message' => 'Anomaly engine is unavailable'
        ]);
        exit();
    }

    http_response_code($httpCode);
    echo $response;
    exit();

} else {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed'
    ]);
    exit();
}
?>
