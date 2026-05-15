<?php
/**
 * Attendance Logs API
 * GET /api/dashboard/logs.php?date_from=2026-04-01&date_to=2026-04-30
 */

header('Content-Type: application/json');

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendErrorResponse('Method not allowed', 405);
}

$dateFrom = !empty($_GET['date_from']) ? $_GET['date_from'] : '';
$dateTo   = !empty($_GET['date_to'])   ? $_GET['date_to']   : '';

// Validate date format only if provided
if ($dateFrom !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) {
    sendErrorResponse('Invalid date format. Use YYYY-MM-DD', 400);
}
if ($dateTo !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
    sendErrorResponse('Invalid date format. Use YYYY-MM-DD', 400);
}

try {
    $conn = getDBConnection();
    if (!$conn) {
        sendErrorResponse('Database connection failed', 500);
    }

    // Student attendance logs
    $studentQuery = "
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
    ";
    $studentParams = [];

    if ($dateFrom !== '' && $dateTo !== '') {
        $studentQuery .= " WHERE a.date BETWEEN :date_from AND :date_to";
        $studentParams[':date_from'] = $dateFrom;
        $studentParams[':date_to'] = $dateTo;
    } elseif ($dateFrom !== '') {
        $studentQuery .= " WHERE a.date >= :date_from";
        $studentParams[':date_from'] = $dateFrom;
    } elseif ($dateTo !== '') {
        $studentQuery .= " WHERE a.date <= :date_to";
        $studentParams[':date_to'] = $dateTo;
    }

    $stmt = $conn->prepare($studentQuery);
    $stmt->execute($studentParams);
    $studentLogs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Visitor logs
    $visitorQuery = "
        SELECT
            visit_id,
            name,
            time_in,
            date_of_visit AS date
        FROM visitors
    ";
    $visitorParams = [];

    if ($dateFrom !== '' && $dateTo !== '') {
        $visitorQuery .= " WHERE date_of_visit BETWEEN :date_from AND :date_to";
        $visitorParams[':date_from'] = $dateFrom;
        $visitorParams[':date_to'] = $dateTo;
    } elseif ($dateFrom !== '') {
        $visitorQuery .= " WHERE date_of_visit >= :date_from";
        $visitorParams[':date_from'] = $dateFrom;
    } elseif ($dateTo !== '') {
        $visitorQuery .= " WHERE date_of_visit <= :date_to";
        $visitorParams[':date_to'] = $dateTo;
    }

    $stmt2 = $conn->prepare($visitorQuery);
    $stmt2->execute($visitorParams);
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

    // Sort by date DESC then time_in DESC (most recent first)
    usort($logs, function($a, $b) {
        $dateCmp = strcmp($b['date'], $a['date']);
        return $dateCmp !== 0 ? $dateCmp : strcmp($b['time_in'], $a['time_in']);
    });

    sendSuccessResponse('Attendance logs retrieved successfully', $logs);

} catch (PDOException $e) {
    error_log("Dashboard Logs Error: " . $e->getMessage());
    sendErrorResponse('Failed to retrieve attendance logs: ' . $e->getMessage(), 500);
}
?>