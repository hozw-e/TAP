<?php
/**
 * List Attendance Logs API
 * GET /api/attendance/list.php
 * 
 * Query Parameters:
 * - date: Filter by specific date (YYYY-MM-DD)
 * - student_id: Filter by specific student
 * 
 * Example: /api/attendance/list.php?date=2026-02-13
 */

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/jwt.php';

// Check authentication (JWT or Session)
requireAuth();

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
    // Build query with optional filters
    $query = "
        SELECT 
            a.attendance_id,
            a.student_id,
            a.date,
            a.time_in,
            a.time_out,
            s.student_name,
            g.guardian_name,
            g.guardian_cellnum
        FROM attendance_logs a
        INNER JOIN students s ON a.student_id = s.student_id
        INNER JOIN guardians g ON s.guardian_id = g.guardian_id
    ";
    
    $conditions = [];
    $params = [];
    
    // Filter by date
    if (isset($_GET['date']) && !empty($_GET['date'])) {
        $conditions[] = "a.date = :date";
        $params['date'] = $_GET['date'];
    }
    
    // Filter by student
    if (isset($_GET['student_id']) && !empty($_GET['student_id'])) {
        $conditions[] = "a.student_id = :student_id";
        $params['student_id'] = intval($_GET['student_id']);
    }
    
    if (!empty($conditions)) {
        $query .= " WHERE " . implode(" AND ", $conditions);
    }
    
    $query .= " ORDER BY a.date DESC, a.time_in DESC";
    
    $stmt = $conn->prepare($query);
    $stmt->execute($params);
    $logs = $stmt->fetchAll();
    
    sendSuccessResponse('Attendance logs retrieved successfully', $logs);
    
} catch (PDOException $e) {
    error_log("List Attendance Error: " . $e->getMessage());
    sendErrorResponse('Failed to retrieve attendance logs', 500);
}
?>
