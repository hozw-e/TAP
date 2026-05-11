<?php
/**
 * Archive Student API
 * POST /api/students/archive.php?id={student_id}
 *
 * Archives a student (soft delete)
 */

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/session.php';
require_once '../../utils/activity-logger.php';

// Check admin authentication
requireAdminAuth();

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendErrorResponse('Method not allowed', 405);
}

// Get student ID from query parameter
$studentId = isset($_GET['id']) ? intval($_GET['id']) : 0;

if ($studentId <= 0) {
    sendErrorResponse('Invalid student ID', 400);
}

try {
    $conn = getDBConnection();
    
    if (!$conn) {
        sendErrorResponse('Database connection failed', 500);
    }
    
    // Check if student exists and is not already archived
    $stmt = $conn->prepare("SELECT student_id, student_name, is_archived FROM students WHERE student_id = :student_id");
    $stmt->execute([':student_id' => $studentId]);
    $student = $stmt->fetch();
    
    if (!$student) {
        sendErrorResponse('Student not found', 404);
    }
    
    if ($student['is_archived'] == 1) {
        sendErrorResponse('Student is already archived', 400);
    }
    
    // Archive the student
    $stmt = $conn->prepare("UPDATE students SET is_archived = 1 WHERE student_id = :student_id");
    $stmt->execute([':student_id' => $studentId]);
    
    // Log the activity
    logActivity('ARCHIVE', 'STUDENT', $student['student_name'], 'Student archived: ' . $student['student_name']);
    
    sendSuccessResponse('Student archived successfully', [
        'student_id' => $studentId,
        'student_name' => $student['student_name']
    ]);
    
} catch (PDOException $e) {
    error_log("Archive student error: " . $e->getMessage());
    sendErrorResponse('Failed to archive student', 500);
}
?>
