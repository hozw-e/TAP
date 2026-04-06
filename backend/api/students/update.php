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

// Get JSON input
$data = json_decode(file_get_contents('php://input'), true);

// Validate input
if (empty($data['student_name'])) {
    sendErrorResponse('Student name is required');
}

try {
    $conn = getDBConnection();
    
    if (!$conn) {
        sendErrorResponse('Database connection failed');
    }
    
    // Update student
    $stmt = $conn->prepare("
        UPDATE students 
        SET student_name = :student_name,
            address = :address,
            student_cellnum = :student_cellnum
        WHERE student_id = :student_id
    ");
    
    $stmt->execute([
        ':student_name' => $data['student_name'],
        ':address' => $data['address'] ?? null,
        ':student_cellnum' => $data['student_cellnum'] ?? null,
        ':student_id' => $studentId
    ]);
    
    if ($stmt->rowCount() > 0 || $stmt->rowCount() === 0) {
        // rowCount() === 0 means no changes but record exists
        sendSuccessResponse('Student updated successfully', [
            'student_id' => $studentId
        ]);
    } else {
        sendErrorResponse('Student not found');
    }
    
} catch (PDOException $e) {
    error_log("Update student error: " . $e->getMessage());
    sendErrorResponse('Failed to update student');
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

// Get JSON input
$data = json_decode(file_get_contents('php://input'), true);

// Validate input
if (empty($data['student_name'])) {
    sendErrorResponse('Student name is required');
}

try {
    $conn = getDBConnection();
    
    if (!$conn) {
        sendErrorResponse('Database connection failed');
    }
    
    // Update student
    $stmt = $conn->prepare("
        UPDATE students 
        SET student_name = :student_name,
            address = :address,
            student_cellnum = :student_cellnum
        WHERE student_id = :student_id
    ");
    
    $stmt->execute([
        ':student_name' => $data['student_name'],
        ':address' => $data['address'] ?? null,
        ':student_cellnum' => $data['student_cellnum'] ?? null,
        ':student_id' => $studentId
    ]);
    
    if ($stmt->rowCount() > 0) {
        sendSuccessResponse('Student updated successfully', [
            'student_id' => $studentId
        ]);
    } else {
        sendErrorResponse('Student not found or no changes made');
    }
    
} catch (PDOException $e) {
    error_log("Update student error: " . $e->getMessage());
    sendErrorResponse('Failed to update student');
} */
?>
