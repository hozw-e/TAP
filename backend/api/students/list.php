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
            s.*,
            g.guardian_name,
            g.guardian_cellnum,
            n.uid as nfc_uid
        FROM students s
        LEFT JOIN guardians g ON s.guardian_id = g.guardian_id
        LEFT JOIN nfc_tags n ON s.student_id = n.student_id
        ORDER BY s.student_name ASC
    ");
    $students = $stmt->fetchAll();
    
    sendSuccessResponse('Students retrieved successfully', $students);
    
} catch (PDOException $e) {
    error_log("List Students Error: " . $e->getMessage());
    sendErrorResponse('Failed to retrieve students', 500);
}
?>
