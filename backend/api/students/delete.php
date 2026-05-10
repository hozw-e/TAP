<?php
require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/session.php';
require_once '../../utils/activity-logger.php';

// Check if admin is logged in
requireAdminAuth();

// Get student ID from query parameter
$studentId = isset($_GET['id']) ? intval($_GET['id']) : 0;

if ($studentId <= 0) {
    sendErrorResponse('Invalid student ID');
}

try {
    $conn = getDBConnection();
    
    if (!$conn) {
        sendErrorResponse('Database connection failed');
    }
    
    // Get guardian_id and archive status before deleting student
    $stmt = $conn->prepare("SELECT guardian_id, student_name, is_archived FROM students WHERE student_id = :student_id");
    $stmt->execute([':student_id' => $studentId]);
    $student = $stmt->fetch();
    
    if (!$student) {
        sendErrorResponse('Student not found');
    }
    
    // Only allow deleting archived students
    if ($student['is_archived'] == 0) {
        sendErrorResponse('Cannot delete active student. Please archive the student first.');
    }
    
    $guardianId = $student['guardian_id'];
    
    // First, delete related NFC tags (if any)
    $stmtNfc = $conn->prepare("DELETE FROM nfc_tags WHERE student_id = :student_id");
    $stmtNfc->execute([':student_id' => $studentId]);
    
    // Second, delete attendance logs (if any)
    $stmtLogs = $conn->prepare("DELETE FROM attendance_logs WHERE student_id = :student_id");
    $stmtLogs->execute([':student_id' => $studentId]);
    
    // Third, delete the student
    $stmt = $conn->prepare("DELETE FROM students WHERE student_id = :student_id");
    $stmt->execute([':student_id' => $studentId]);
    
    // Finally, delete the guardian (if this was their only student)
    if ($guardianId) {
        // Check if guardian has other students
        $stmt = $conn->prepare("SELECT COUNT(*) as count FROM students WHERE guardian_id = :guardian_id");
        $stmt->execute([':guardian_id' => $guardianId]);
        $result = $stmt->fetch();
        
        if ($result['count'] == 0) {
            // No other students, safe to delete guardian
            $stmt = $conn->prepare("DELETE FROM guardians WHERE guardian_id = :guardian_id");
            $stmt->execute([':guardian_id' => $guardianId]);
        }
    }
    
    // Log the activity
    logActivity($conn, 'student_deleted', 'Student permanently deleted: ' . $student['student_name'], $studentId);
    
    sendSuccessResponse('Student and related records deleted successfully', [
        'student_id' => $studentId
    ]);
    
} catch (PDOException $e) {
    error_log("Delete student error: " . $e->getMessage());
    sendErrorResponse('Failed to delete student');
}
?>