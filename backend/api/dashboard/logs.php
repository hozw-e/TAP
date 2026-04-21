<?php
/**
 * Attendance Logs API
 * GET /api/dashboard/logs.php?date=2026-04-19
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../../config/database.php';
require_once '../../utils/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendErrorResponse('Method not allowed', 405);
}

$date = isset($_GET['date']) ? $_GET['date'] : date('Y-m-d');

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    sendErrorResponse('Invalid date format. Use YYYY-MM-DD', 400);
}

try {
    $conn = getDBConnection();

    if (!$conn) {
        sendErrorResponse('Database connection failed', 500);
    }

    $stmt = $conn->prepare("
        SELECT 
            a.attendance_id,
            a.student_id,
            a.date,
            a.time_in,
            a.time_out,
            s.student_name,
            0 as sms_sent
        FROM attendance_logs a
        LEFT JOIN students s ON a.student_id = s.student_id
        WHERE a.date = :date
        ORDER BY a.time_in DESC
    ");

    $stmt->execute([':date' => $date]);
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($logs as &$log) {
        $log['sms_sent'] = (bool)$log['sms_sent'];
    }

    sendSuccessResponse('Attendance logs retrieved successfully', $logs);

} catch (PDOException $e) {
    error_log("Dashboard Logs Error: " . $e->getMessage());
    sendErrorResponse('Failed to retrieve attendance logs: ' . $e->getMessage(), 500);
} catch (Exception $e) {
    error_log("Dashboard Logs Error: " . $e->getMessage());
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
?>