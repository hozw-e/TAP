<?php
/**
 * Delete Course Schedule API
 * DELETE /api/course-schedules/delete.php?id=1
 * 
 * Deletes a course schedule by ID
 */

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/session.php';
require_once '../../utils/activity-logger.php';

header('Content-Type: application/json');
requireAdminAuth();

// Only allow DELETE requests
if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    sendErrorResponse('Method not allowed', 405);
}

// Get schedule ID from query parameter
$scheduleId = isset($_GET['id']) ? intval($_GET['id']) : 0;

if ($scheduleId <= 0) {
    sendErrorResponse('Invalid schedule ID', 400);
}

// Get database connection
$conn = getDBConnection();
if (!$conn) {
    sendErrorResponse('Database connection failed', 500);
}

try {
    // Check if schedule exists
    $checkStmt = $conn->prepare("SELECT schedule_id FROM course_schedules WHERE schedule_id = :id");
    $checkStmt->execute([':id' => $scheduleId]);

    $schedule = $checkStmt->fetch(PDO::FETCH_ASSOC);
    if (!$schedule) {
        sendErrorResponse('Course schedule not found', 404);
    }

    // Delete the schedule
    $stmt = $conn->prepare("DELETE FROM course_schedules WHERE schedule_id = :schedule_id");
    $stmt->execute([':schedule_id' => $scheduleId]);

    logActivity('DELETE', 'COURSE_SCHEDULE', "Schedule #{$scheduleId}", "Deleted course schedule ID: {$scheduleId}");

    sendSuccessResponse('Course schedule deleted successfully', [
        'schedule_id' => $scheduleId
    ]);

} catch (PDOException $e) {
    error_log("Delete Course Schedule Error: " . $e->getMessage());
    sendErrorResponse('Failed to delete course schedule', 500);
}
?>
