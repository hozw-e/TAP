<?php
/**
 * Assign NFC Tag to Student API
 * POST /api/nfc/assign.php
 * 
 * Request Body:
 * {
 *   "student_id": 1,
 *   "uid": "A1B2C3D4"
 * }
 */

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/session.php';

// Check admin authentication
requireAdminAuth();

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendErrorResponse('Method not allowed', 405);
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Validate required fields
$missingFields = validateRequiredFields($input, ['student_id', 'uid']);
if ($missingFields) {
    sendErrorResponse('Missing required fields: ' . implode(', ', $missingFields), 400);
}

$studentId = intval($input['student_id']);
$uid = trim($input['uid']);

// Get database connection
$conn = getDBConnection();
if (!$conn) {
    sendErrorResponse('Database connection failed', 500);
}

try {
    // Verify student exists
    $stmt = $conn->prepare("SELECT student_id, student_name FROM students WHERE student_id = :id");
    $stmt->execute(['id' => $studentId]);
    $student = $stmt->fetch();
    
    if (!$student) {
        sendErrorResponse('Student not found', 404);
    }
    
    // Check if UID already exists
    $stmt = $conn->prepare("SELECT student_id FROM nfc_tags WHERE uid = :uid");
    $stmt->execute(['uid' => $uid]);
    if ($stmt->fetch()) {
        sendErrorResponse('This NFC tag is already assigned to another student', 409);
    }
    
    // Check if student already has an NFC tag
    $stmt = $conn->prepare("SELECT nfctag_id FROM nfc_tags WHERE student_id = :student_id");
    $stmt->execute(['student_id' => $studentId]);
    $existing = $stmt->fetch();
    
    if ($existing) {
        // Update existing tag
        $stmt = $conn->prepare("UPDATE nfc_tags SET uid = :uid WHERE student_id = :student_id");
        $stmt->execute([
            'uid' => $uid,
            'student_id' => $studentId
        ]);
        $message = 'NFC tag updated successfully';
    } else {
        // Insert new tag
        $stmt = $conn->prepare("INSERT INTO nfc_tags (student_id, uid) VALUES (:student_id, :uid)");
        $stmt->execute([
            'student_id' => $studentId,
            'uid' => $uid
        ]);
        $message = 'NFC tag assigned successfully';
    }
    
    sendSuccessResponse($message, [
    'student_id' => $studentId,
    'student_name' => $student['student_name'],
    'uid' => $uid
    ]);
    
} catch (PDOException $e) {
    error_log("Assign NFC Error: " . $e->getMessage());
    sendErrorResponse('Failed to assign NFC tag', 500);
}
?>
