<?php
/**
 * Dashboard Trend API
 * GET /api/dashboard/trend.php
 * Returns a 30-day rolling window of daily student and visitor counts.
 */

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/session.php';

header('Content-Type: application/json');

// Check admin authentication
requireAdminAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendErrorResponse('Method not allowed', 405);
}

try {
    $conn = getDBConnection();

    if (!$conn) {
        sendErrorResponse('Database connection failed', 500);
    }

    $today = date('Y-m-d');
    $startDate = date('Y-m-d', strtotime('-29 days'));

    // Get distinct student check-ins per day for the 30-day window
    $stmtStudents = $conn->prepare("
        SELECT date, COUNT(DISTINCT student_id) as students
        FROM attendance_logs
        WHERE date >= :start_date AND date <= :end_date
        GROUP BY date
    ");
    $stmtStudents->execute([':start_date' => $startDate, ':end_date' => $today]);
    $studentRows = $stmtStudents->fetchAll(PDO::FETCH_ASSOC);

    // Index student counts by date
    $studentsByDate = [];
    foreach ($studentRows as $row) {
        $studentsByDate[$row['date']] = (int)$row['students'];
    }

    // Get distinct visitor check-ins per day for the 30-day window
    $stmtVisitors = $conn->prepare("
        SELECT date_of_visit, COUNT(DISTINCT visit_id) as visitors
        FROM visitors
        WHERE date_of_visit >= :start_date AND date_of_visit <= :end_date
        GROUP BY date_of_visit
    ");
    $stmtVisitors->execute([':start_date' => $startDate, ':end_date' => $today]);
    $visitorRows = $stmtVisitors->fetchAll(PDO::FETCH_ASSOC);

    // Index visitor counts by date
    $visitorsByDate = [];
    foreach ($visitorRows as $row) {
        $visitorsByDate[$row['date_of_visit']] = (int)$row['visitors'];
    }

    // Build the 30-day trend array in chronological order
    $trendData = [];
    for ($i = 29; $i >= 0; $i--) {
        $date = date('Y-m-d', strtotime("-{$i} days"));
        $trendData[] = [
            'date' => $date,
            'students' => $studentsByDate[$date] ?? 0,
            'visitors' => $visitorsByDate[$date] ?? 0
        ];
    }

    sendSuccessResponse('Trend data retrieved successfully', $trendData);

} catch (PDOException $e) {
    error_log("Dashboard Trend Error: " . $e->getMessage());
    sendErrorResponse('Failed to retrieve trend data', 500);
} catch (Exception $e) {
    error_log("Dashboard Trend Error: " . $e->getMessage());
    sendErrorResponse('Server error', 500);
}
?>
