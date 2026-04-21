<?php
/**
 * Dashboard Stats API
 * GET /api/dashboard/stats.php
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

    // Present today (checked in but not yet checked out)
    $stmt = $conn->prepare("
        SELECT COUNT(DISTINCT student_id) as present 
        FROM attendance_logs 
        WHERE date = :today 
        AND time_out IS NULL
    ");
    $stmt->execute([':today' => $today]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $presentToday = (int)$result['present'];

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
    sendErrorResponse('Failed to retrieve stats: ' . $e->getMessage(), 500);
} catch (Exception $e) {
    error_log("Dashboard Stats Error: " . $e->getMessage());
    sendErrorResponse('Server error: ' . $e->getMessage(), 500);
}
?>