<?php
/**
 * Unarchive Student API
 * POST /api/students/unarchive.php?id={student_id}
 *
 * Unarchives a student (restore from archive)
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
    
    // Check if student exists and is archived
    $stmt = $conn->prepare("SELECT student_id, student_name, is_archived FROM students WHERE student_id = :student_id");
    $stmt->execute([':student_id' => $studentId]);
    $student = $stmt->fetch();
    
    if (!$student) {
        sendErrorResponse('Student not found', 404);
    }
    
    if ($student['is_archived'] == 0) {
        sendErrorResponse('Student is not archived', 400);
    }
    
    // Unarchive the student
    $stmt = $conn->prepare("UPDATE students SET is_archived = 0 WHERE student_id = :student_id");
    $stmt->execute([':student_id' => $studentId]);
    
    // Log the activity
    logActivity('UNARCHIVE', 'STUDENT', $student['student_name'], 'Student unarchived: ' . $student['student_name']);
    
    sendSuccessResponse('Student unarchived successfully', [
        'student_id' => $studentId,
        'student_name' => $student['student_name']
    ]);
    
} catch (PDOException $e) {
    error_log("Unarchive student error: " . $e->getMessage());
    sendErrorResponse('Failed to unarchive student', 500);
}
?>
