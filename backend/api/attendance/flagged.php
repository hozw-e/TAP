<?php
/**
 * Flagged Attendance Logs API
 * GET /api/attendance/flagged.php
 * 
 * Query Parameters:
 * - flag: Comma-separated list of flags to filter by (e.g. "tardy,absent"). Valid values: "present", "tardy", "absent"
 * - date_from: Start date filter (Y-m-d format)
 * - date_to: End date filter (Y-m-d format)
 * - course: Course name filter
 * 
 * Example: /api/attendance/flagged.php?flag=tardy,absent&date_from=2026-01-01&date_to=2026-02-28&course=BSIT
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
    // Base query
    $query = "
        SELECT 
            al.attendance_id,
            al.student_id,
            al.date,
            al.time_in,
            al.time_out,
            al.attendance_flag,
            s.student_name,
            s.student_course
        FROM attendance_logs al
        LEFT JOIN students s ON al.student_id = s.student_id
        WHERE al.attendance_flag IS NOT NULL
    ";

    $conditions = [];
    $params = [];
    $validFlags = ['present', 'tardy', 'absent'];

    // Filter by flag(s)
    if (isset($_GET['flag']) && !empty($_GET['flag'])) {
        $flagsRaw = explode(',', $_GET['flag']);
        $flags = array_filter(array_map('trim', $flagsRaw), function ($f) use ($validFlags) {
            return in_array($f, $validFlags);
        });

        if (!empty($flags)) {
            $placeholders = [];
            foreach ($flags as $i => $flag) {
                $key = "flag_$i";
                $placeholders[] = ":$key";
                $params[$key] = $flag;
            }
            $conditions[] = "al.attendance_flag IN (" . implode(', ', $placeholders) . ")";
        }
    }

    // Filter by date_from
    if (isset($_GET['date_from']) && !empty($_GET['date_from'])) {
        $conditions[] = "al.date >= :date_from";
        $params['date_from'] = $_GET['date_from'];
    }

    // Filter by date_to
    if (isset($_GET['date_to']) && !empty($_GET['date_to'])) {
        $conditions[] = "al.date <= :date_to";
        $params['date_to'] = $_GET['date_to'];
    }

    // Filter by course
    if (isset($_GET['course']) && !empty($_GET['course'])) {
        $conditions[] = "s.student_course = :course";
        $params['course'] = $_GET['course'];
    }

    // Append dynamic conditions
    if (!empty($conditions)) {
        $query .= " AND " . implode(" AND ", $conditions);
    }

    $query .= " ORDER BY al.date DESC, al.attendance_id DESC";

    $stmt = $conn->prepare($query);
    $stmt->execute($params);
    $logs = $stmt->fetchAll();

    sendSuccessResponse('Flagged attendance logs retrieved successfully', $logs);

} catch (PDOException $e) {
    error_log("Flagged Attendance Error: " . $e->getMessage());
    sendErrorResponse('Failed to retrieve flagged attendance logs', 500);
}
?>
