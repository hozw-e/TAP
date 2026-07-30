<?php
/**
 * List Course Schedules API
 * GET /api/course-schedules/list.php
 * 
 * Returns all course schedules
 */

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/session.php';

header('Content-Type: application/json');
requireAdminAuth();

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendErrorResponse('Method not allowed', 405);
}

// Get database connection
$conn = getDBConnection();
if (!$conn) {
    sendErrorResponse('Database connection failed', 500);
}

try {
    $stmt = $conn->query("SELECT * FROM course_schedules ORDER BY course_name ASC, day_of_week ASC, start_time ASC");
    $schedules = $stmt->fetchAll();

    // Ensure total_hours is returned as float or null (not string from PDO)
    foreach ($schedules as &$schedule) {
        $schedule['total_hours'] = isset($schedule['total_hours']) && $schedule['total_hours'] !== null
            ? (float) $schedule['total_hours']
            : null;
    }
    unset($schedule);

    sendSuccessResponse('Course schedules retrieved successfully', $schedules);

} catch (PDOException $e) {
    error_log("List Course Schedules Error: " . $e->getMessage());
    sendErrorResponse('Failed to retrieve course schedules', 500);
}
?>
