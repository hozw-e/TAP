<?php
/**
 * Attendance Logs API
 * GET /api/dashboard/logs.php?date=2026-04-19
 *
 * Returns students attendance + visitor check-ins merged and sorted by time
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

    $stmt = $conn->prepare("
        SELECT
            a.attendance_id,
            s.student_name                              AS student_name,
            a.time_in,
            a.time_out,
            a.sms_sent,
            CONVERT('student' USING utf8mb4)            AS row_type
        FROM attendance_logs a
        LEFT JOIN students s ON a.student_id = s.student_id
        WHERE a.date = :date

        UNION ALL

        SELECT
            v.visit_id                                  AS attendance_id,
            CONVERT(v.name USING utf8mb4)               AS student_name,
            v.time_in,
            NULL                                        AS time_out,
            NULL                                        AS sms_sent,
            CONVERT('visitor' USING utf8mb4)            AS row_type
        FROM visitors v
        WHERE v.date_of_visit = :date2

        ORDER BY time_in ASC
    ");

    $stmt->execute([':date' => $date, ':date2' => $date]);
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Convert sms_sent to boolean for student rows
    foreach ($logs as &$log) {
        if ($log['row_type'] === 'student') {
            $log['sms_sent'] = (bool)$log['sms_sent'];
        } else {
            $log['sms_sent'] = null;
        }
    }

    sendSuccessResponse('Attendance logs retrieved successfully', $logs);

} catch (PDOException $e) {
    error_log("Dashboard Logs Error: " . $e->getMessage());
    sendErrorResponse('Failed to retrieve attendance logs: ' . $e->getMessage(), 500);
}
?>