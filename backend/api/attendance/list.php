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
require_once '../../utils/session.php';

// Check admin authentication
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
    // Check if notification columns exist (migration 007 may not have run yet)
    $hasNotifCols = false;
    try {
        $colCheck = $conn->query("
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME   = 'attendance_logs'
              AND COLUMN_NAME  = 'msg_channel'
        ");
        $hasNotifCols = (int)$colCheck->fetchColumn() > 0;
    } catch (Exception $e) {
        // Default to false
    }

    $notifSelect = $hasNotifCols
        ? 'a.msg_channel, a.msg_success, a.msg_out_channel, a.msg_out_success, a.attendance_flag,'
        : "NULL AS msg_channel, NULL AS msg_success, NULL AS msg_out_channel, NULL AS msg_out_success, NULL AS attendance_flag,";

    // Check if auto_closed column exists
    $hasAutoClosedCol = false;
    try {
        $colCheck = $conn->query("
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'attendance_logs'
              AND COLUMN_NAME = 'auto_closed'
        ");
        $hasAutoClosedCol = (int)$colCheck->fetchColumn() > 0;
    } catch (Exception $e) {
        // Default to false if check fails
    }

    $autoClosedSelect = $hasAutoClosedCol ? 'a.auto_closed' : '0 AS auto_closed';

    // Build query with optional filters
    $query = "
        SELECT 
            a.attendance_id,
            a.student_id,
            a.date,
            a.time_in,
            a.time_out,
            {$autoClosedSelect},
            {$notifSelect}
            a.sms_sent_in,
            a.sms_sent_out,
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
