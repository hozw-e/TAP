<?php
/**
 * Attendance Logs API
 * GET /api/dashboard/logs.php?date_from=2026-04-01&date_to=2026-04-30
 */

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/jwt.php';

// Check authentication (JWT or Session)
requireAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendErrorResponse('Method not allowed', 405);
}

$dateFrom = isset($_GET['date_from']) ? $_GET['date_from'] : date('Y-m-d');
$dateTo   = isset($_GET['date_to'])   ? $_GET['date_to']   : date('Y-m-d');

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
    sendErrorResponse('Invalid date format. Use YYYY-MM-DD', 400);
}

try {
    $conn = getDBConnection();
    if (!$conn) {
        sendErrorResponse('Database connection failed', 500);
    }

    // Student attendance logs
    $stmt = $conn->prepare("
        SELECT
            a.attendance_id,
            s.student_name,
            s.student_course,
            a.time_in,
            a.time_out,
            a.sms_sent,
            a.date
        FROM attendance_logs a
        LEFT JOIN students s ON a.student_id = s.student_id
        WHERE a.date BETWEEN :date_from AND :date_to
    ");
    $stmt->execute([':date_from' => $dateFrom, ':date_to' => $dateTo]);
    $studentLogs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Visitor logs
    $stmt2 = $conn->prepare("
        SELECT
            visit_id,
            name,
            time_in,
            date_of_visit AS date
        FROM visitors
        WHERE date_of_visit BETWEEN :date_from AND :date_to
    ");
    $stmt2->execute([':date_from' => $dateFrom, ':date_to' => $dateTo]);
    $visitorLogs = $stmt2->fetchAll(PDO::FETCH_ASSOC);

    $logs = [];

    foreach ($studentLogs as $row) {
        $logs[] = [
            'attendance_id'  => $row['attendance_id'],
            'student_name'   => $row['student_name'],
            'student_course' => $row['student_course'],
            'time_in'        => $row['time_in'],
            'time_out'       => $row['time_out'],
            'sms_sent'       => (bool)$row['sms_sent'],
            'date'           => $row['date'],
            'row_type'       => 'student',
        ];
    }

    foreach ($visitorLogs as $row) {
        $logs[] = [
            'attendance_id'  => $row['visit_id'],
            'student_name'   => $row['name'],
            'student_course' => null,
            'time_in'        => $row['time_in'],
            'time_out'       => null,
            'sms_sent'       => null,
            'date'           => $row['date'],
            'row_type'       => 'visitor',
        ];
    }

    // Sort by date then time_in
    usort($logs, function($a, $b) {
        $dateCmp = strcmp($a['date'], $b['date']);
        return $dateCmp !== 0 ? $dateCmp : strcmp($a['time_in'], $b['time_in']);
    });

    sendSuccessResponse('Attendance logs retrieved successfully', $logs);

} catch (PDOException $e) {
    error_log("Dashboard Logs Error: " . $e->getMessage());
    sendErrorResponse('Failed to retrieve attendance logs: ' . $e->getMessage(), 500);
}
?>