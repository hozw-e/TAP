<?php
/**
 * Dashboard - Today's Course Schedules
 * GET /api/dashboard/schedules-today.php
 * 
 * Returns all course sessions scheduled for today, with enrolled student count.
 */

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/session.php';

header('Content-Type: application/json');
requireAdminAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendErrorResponse('Method not allowed', 405);
}

$conn = getDBConnection();
if (!$conn) {
    sendErrorResponse('Database connection failed', 500);
}

try {
    date_default_timezone_set('Asia/Manila');
    $dayOfWeek = date('l');

    // Get today's schedules
    $stmtSchedules = $conn->prepare("
        SELECT schedule_id, course_name, start_time, end_time
        FROM course_schedules
        WHERE day_of_week = :day_of_week
        ORDER BY start_time ASC
    ");
    $stmtSchedules->execute([':day_of_week' => $dayOfWeek]);
    $schedules = $stmtSchedules->fetchAll(PDO::FETCH_ASSOC);

    // Get enrolled student counts per course
    $stmtCounts = $conn->prepare("
        SELECT student_course, COUNT(*) as count
        FROM students
        WHERE is_archived = 0 OR is_archived IS NULL
        GROUP BY student_course
    ");
    $stmtCounts->execute();
    $counts = $stmtCounts->fetchAll(PDO::FETCH_KEY_PAIR);

    // Attach student count to each schedule
    foreach ($schedules as &$schedule) {
        $schedule['student_count'] = (int)($counts[$schedule['course_name']] ?? 0);
    }

    sendSuccessResponse('Today\'s schedules retrieved', $schedules);

} catch (PDOException $e) {
    error_log("Dashboard Schedules Today Error: " . $e->getMessage());
    sendErrorResponse('Failed to retrieve today\'s schedules', 500);
}
?>
