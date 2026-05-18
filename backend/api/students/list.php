<?php
/**
 * List Students API
 * GET /api/students/list.php
 *
 * Returns all students with their guardian information
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
    // Get archive filter from query parameter (default to active students)
    $isArchived = isset($_GET['archived']) && $_GET['archived'] === '1' ? 1 : 0;
    
    $stmt = $conn->prepare("
        SELECT
            s.student_id,
            s.guardian_id,
            s.student_name,
            s.student_birthdate,
            s.age,
            s.student_address,
            s.student_cellnum,
            s.student_course,
            s.course_duration,
            s.is_archived,
            s.created_at,
            g.guardian_name,
            g.guardian_address,
            g.guardian_cellnum,
            n.uid AS nfc_uid,
            COALESCE(
                SUM(
                    CASE
                        WHEN a.time_in IS NOT NULL AND a.time_out IS NOT NULL
                        THEN TIMESTAMPDIFF(SECOND, a.time_in, a.time_out)
                        ELSE 0
                    END
                ), 0
            ) AS total_seconds
        FROM students s
        LEFT JOIN guardians g ON s.guardian_id = g.guardian_id
        LEFT JOIN nfc_tags n ON s.student_id = n.student_id
        LEFT JOIN attendance_logs a ON s.student_id = a.student_id
        WHERE s.is_archived = :is_archived
        GROUP BY s.student_id, s.guardian_id, s.student_name, s.student_birthdate,
                 s.age, s.student_address, s.student_cellnum, s.student_course,
                 s.course_duration, s.is_archived, s.created_at,
                 g.guardian_name, g.guardian_address, g.guardian_cellnum, n.uid
        ORDER BY s.student_name ASC
    ");
    
    $stmt->execute([':is_archived' => $isArchived]);
    $students = $stmt->fetchAll(PDO::FETCH_ASSOC);

    sendSuccessResponse('Students retrieved successfully', $students);

} catch (PDOException $e) {
    error_log("List Students Error: " . $e->getMessage());
    sendErrorResponse('Failed to retrieve students', 500);
}
?>