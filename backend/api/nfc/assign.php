<?php
/**
 * Assign NFC Tag to Student
 * POST /api/nfc/assign.php
 * 
 * Body: { "student_id": 1, "uid": "5C112949" }
 */

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendErrorResponse('Method not allowed', 405);
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

error_log("NFC Assign received: " . json_encode($input));

// Validate inputs
if (!isset($input['student_id']) || !isset($input['uid'])) {
    sendErrorResponse('student_id and uid are required', 400);
}

$studentId = (int)$input['student_id'];
$uid = strtoupper(trim($input['uid']));

error_log("Assigning NFC: student_id=$studentId, uid=$uid");

try {
    $conn = getDBConnection();
    
    if (!$conn) {
        sendErrorResponse('Database connection failed', 500);
    }
    
    // Check if UID already exists in nfc_tags
    $stmt = $conn->prepare("SELECT nfctag_id, student_id FROM nfc_tags WHERE uid = :uid");
    $stmt->execute([':uid' => $uid]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($existing) {
        // UID exists - update student_id
        error_log("NFC tag exists (nfctag_id={$existing['nfctag_id']}), updating student_id to $studentId");
        
        $stmt = $conn->prepare("
            UPDATE nfc_tags 
            SET student_id = :student_id, assigned_at = NOW() 
            WHERE uid = :uid
        ");
        $stmt->execute([
            ':student_id' => $studentId,
            ':uid' => $uid
        ]);
        
        $message = 'NFC tag reassigned to student';
    } else {
        // UID doesn't exist - create new
        error_log("NFC tag doesn't exist, creating new entry");
        
        $stmt = $conn->prepare("
            INSERT INTO nfc_tags (student_id, uid, assigned_at) 
            VALUES (:student_id, :uid, NOW())
        ");
        $stmt->execute([
            ':student_id' => $studentId,
            ':uid' => $uid
        ]);
        
        $message = 'NFC tag assigned to student';
        error_log("NFC tag created successfully");
    }
    
    // Mark temp scan as consumed
    try {
        $stmt = $conn->prepare("UPDATE temp_nfc_scans SET consumed = TRUE WHERE uid = :uid");
        $stmt->execute([':uid' => $uid]);
        error_log("Temp scan marked as consumed");
    } catch (Exception $e) {
        error_log("Temp scan update failed (this is OK): " . $e->getMessage());
    }
    
    sendSuccessResponse($message, [
        'student_id' => $studentId,
        'uid' => $uid
    ]);
    
} catch (PDOException $e) {
    error_log("Assign NFC Error: " . $e->getMessage());
    sendErrorResponse('Failed to assign NFC tag: ' . $e->getMessage(), 500);
}
?>