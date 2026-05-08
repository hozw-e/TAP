<?php
/**
 * Recent Attendance API
 * GET /api/attendance/recent.php
 * 
 * Returns attendance logs from the last 5 minutes
 * Used for real-time dashboard updates (polling)
 * 
 * Query Parameters:
 * - since: Unix timestamp to get logs after this time (optional)
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
    // Get timestamp for filtering (last 5 minutes or since provided timestamp)
    if (isset($_GET['since']) && is_numeric($_GET['since'])) {
        $sinceTimestamp = date('Y-m-d H:i:s', intval($_GET['since']));
    } else {
        $sinceTimestamp = date('Y-m-d H:i:s', strtotime('-5 minutes'));
    }
    
    // Get recent attendance logs
    // We check both time_in and time_out changes by looking at the most recent activity
    $stmt = $conn->prepare("
        SELECT 
            a.attendance_id,
            a.student_id,
            a.date,
            a.time_in,
            a.time_out,
            s.student_name,
            g.guardian_name,
            CASE 
                WHEN a.time_out IS NOT NULL THEN 'TIME OUT'
                ELSE 'TIME IN'
            END as action,
            GREATEST(
                CONCAT(a.date, ' ', COALESCE(a.time_in, '00:00:00')),
                CONCAT(a.date, ' ', COALESCE(a.time_out, '00:00:00'))
            ) as last_activity
        FROM attendance_logs a
        INNER JOIN students s ON a.student_id = s.student_id
        INNER JOIN guardians g ON s.guardian_id = g.guardian_id
        WHERE a.date = CURDATE()
        HAVING last_activity >= :since_timestamp
        ORDER BY last_activity DESC
    ");
    
    $stmt->execute(['since_timestamp' => $sinceTimestamp]);
    $recentLogs = $stmt->fetchAll();
    
    sendSuccessResponse('Recent attendance retrieved successfully', [
        'logs' => $recentLogs,
        'count' => count($recentLogs),
        'timestamp' => time()
    ]);
    
} catch (PDOException $e) {
    error_log("Recent Attendance Error: " . $e->getMessage());
    sendErrorResponse('Failed to retrieve recent attendance', 500);
}
?>
