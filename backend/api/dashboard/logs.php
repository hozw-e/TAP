<?php
/**
 * Attendance Logs API
 * GET /api/dashboard/logs.php?date=2026-04-19
 */

header('Content-Type: application/json');

require_once '../../config/database.php';
require_once '../../utils/cors.php';
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

    // Query 1: Student attendance logs
    $stmt = $conn->prepare("
        SELECT
            a.attendance_id,
            s.student_name,
            a.time_in,
            a.time_out,
            a.sms_sent
        FROM attendance_logs a
        LEFT JOIN students s ON a.student_id = s.student_id
        WHERE a.date = :date
    ");
    $stmt->execute([':date' => $date]);
    $studentLogs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Query 2: Visitor logs
    $stmt2 = $conn->prepare("
        SELECT
            visit_id,
            name,
            time_in
        FROM visitors
        WHERE date_of_visit = :date
    ");
    $stmt2->execute([':date' => $date]);
    $visitorLogs = $stmt2->fetchAll(PDO::FETCH_ASSOC);

    // Merge in PHP
    $logs = [];

    foreach ($studentLogs as $row) {
        $logs[] = [
            'attendance_id' => $row['attendance_id'],
            'student_name'  => $row['student_name'],
            'time_in'       => $row['time_in'],
            'time_out'      => $row['time_out'],
            'sms_sent'      => (bool)$row['sms_sent'],
            'row_type'      => 'student',
        ];
    }

    foreach ($visitorLogs as $row) {
        $logs[] = [
            'attendance_id' => $row['visit_id'],
            'student_name'  => $row['name'],
            'time_in'       => $row['time_in'],
            'time_out'      => null,
            'sms_sent'      => null,
            'row_type'      => 'visitor',
        ];
    }

    // Sort merged array by time_in ASC
    usort($logs, function($a, $b) {
        return strcmp($a['time_in'], $b['time_in']);
    });

    sendSuccessResponse('Attendance logs retrieved successfully', $logs);

} catch (PDOException $e) {
    error_log("Dashboard Logs Error: " . $e->getMessage());
    sendErrorResponse('Failed to retrieve attendance logs: ' . $e->getMessage(), 500);
}
?>