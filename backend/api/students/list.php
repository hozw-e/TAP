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
    $stmt = $conn->query("
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
            s.created_at,
            g.guardian_name,
            g.guardian_address,
            g.guardian_cellnum,
            n.uid AS nfc_uid
        FROM students s
        LEFT JOIN guardians g ON s.guardian_id = g.guardian_id
        LEFT JOIN nfc_tags n ON s.student_id = n.student_id
        ORDER BY s.student_name ASC
    ");

    $students = $stmt->fetchAll(PDO::FETCH_ASSOC);

    sendSuccessResponse('Students retrieved successfully', $students);

} catch (PDOException $e) {
    error_log("List Students Error: " . $e->getMessage());
    sendErrorResponse('Failed to retrieve students', 500);
}
?>