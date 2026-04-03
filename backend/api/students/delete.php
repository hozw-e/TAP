<?php
require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/session.php';
 
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
    
    // First, delete related NFC tags (if any)
    $stmtNfc = $conn->prepare("DELETE FROM nfc_tags WHERE student_id = :student_id");
    $stmtNfc->execute([':student_id' => $studentId]);
    
    // Then delete student (attendance_logs will cascade if you set ON DELETE CASCADE)
    $stmt = $conn->prepare("DELETE FROM students WHERE student_id = :student_id");
    $stmt->execute([':student_id' => $studentId]);
    
    if ($stmt->rowCount() > 0) {
        sendSuccessResponse('Student deleted successfully', [
            'student_id' => $studentId
        ]);
    } else {
        sendErrorResponse('Student not found');
    }
    
} catch (PDOException $e) {
    error_log("Delete student error: " . $e->getMessage());
    sendErrorResponse('Failed to delete student');
}

/* ----------------- old code ----------------- */
/* require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/session.php';

// Check if admin is logged in
checkAdminSession();

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
    
    // Delete student (cascading deletes will handle related records)
    $stmt = $conn->prepare("DELETE FROM students WHERE student_id = :student_id");
    $stmt->execute([':student_id' => $studentId]);
    
    if ($stmt->rowCount() > 0) {
        sendSuccessResponse('Student deleted successfully', [
            'student_id' => $studentId
        ]);
    } else {
        sendErrorResponse('Student not found');
    }
    
} catch (PDOException $e) {
    error_log("Delete student error: " . $e->getMessage());
    sendErrorResponse('Failed to delete student');
} */
?>
