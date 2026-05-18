<?php
/**
 * Dashboard Stats API
 * GET /api/dashboard/stats.php
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

    // Total students
    $stmt = $conn->query("SELECT COUNT(*) as total FROM students");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $totalStudents = (int)$result['total'];


    // Present students today (checked in but not yet checked out)
    $stmt = $conn->prepare("
        SELECT COUNT(DISTINCT student_id) as present 
        FROM attendance_logs 
        WHERE date = :today 
        AND time_out IS NULL
    ");
    $stmt->execute([':today' => $today]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $presentStudents = (int)$result['present'];

    // Present visitors today (checked in today)
    $stmt = $conn->prepare("
        SELECT COUNT(*) as present FROM visitors WHERE date_of_visit = :today
    ");
    $stmt->execute([':today' => $today]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $presentVisitors = (int)$result['present'];

    $presentToday = $presentStudents + $presentVisitors;

    // Enrolled today
    $stmt = $conn->prepare("
        SELECT COUNT(*) as enrolled 
        FROM students 
        WHERE DATE(created_at) = :today
    ");
    $stmt->execute([':today' => $today]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $enrolledToday = (int)$result['enrolled'];

    sendSuccessResponse('Dashboard stats retrieved successfully', [
        'totalStudents' => $totalStudents,
        'presentToday'  => $presentToday,
        'enrolledToday' => $enrolledToday
    ]);

} catch (PDOException $e) {
    error_log("Dashboard Stats Error: " . $e->getMessage());
    sendErrorResponse('Failed to retrieve stats', 500);
} catch (Exception $e) {
    error_log("Dashboard Stats Error: " . $e->getMessage());
    sendErrorResponse('Server error', 500);
}
?>