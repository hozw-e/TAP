<?php
/**
 * NFC Scan API - Main Attendance Logging Endpoint
 * POST /api/nfc/scan.php
 * 
 * This endpoint is called by ESP32/Arduino when a student scans their NFC tag
 * 
 * Request Body:
 * {
 *   "uid": "A1B2C3D4"
 * }
 * 
 * IMPORTANT: Admin MUST be logged in for attendance to be logged
 */

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/session.php';

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendErrorResponse('Method not allowed', 405);
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Validate required fields
$missingFields = validateRequiredFields($input, ['uid']);
if ($missingFields) {
    sendErrorResponse('Missing required fields: uid', 400);
}

$uid = trim($input['uid']);

// CRITICAL: Check if admin is logged in
if (!isAdminLoggedIn()) {
    sendErrorResponse('Cannot log attendance: No admin session active. Admin must be logged in.', 403);
}

// Get database connection
$conn = getDBConnection();
if (!$conn) {
    sendErrorResponse('Database connection failed', 500);
}

try {
    // Look up student by NFC UID
    $stmt = $conn->prepare("
        SELECT 
            s.student_id,
            s.student_name,
            s.guardian_id,
            g.guardian_name,
            g.guardian_cellnum
        FROM nfc_tags n
        INNER JOIN students s ON n.student_id = s.student_id
        INNER JOIN guardians g ON s.guardian_id = g.guardian_id
        WHERE n.uid = :uid
    ");
    $stmt->execute(['uid' => $uid]);
    $student = $stmt->fetch();
    
    if (!$student) {
        sendErrorResponse('NFC tag not recognized. Please register this tag first.', 404);
    }
    
    // Get today's date
    $today = date('Y-m-d');
    
    // Check if student already has a log for today
    $stmt = $conn->prepare("
        SELECT attendance_id, time_in, time_out 
        FROM attendance_logs 
        WHERE student_id = :student_id AND date = :date
    ");
    $stmt->execute([
        'student_id' => $student['student_id'],
        'date' => $today
    ]);
    $existingLog = $stmt->fetch();
    
    $isTimeIn = false;
    $isTimeOut = false;
    
    if (!$existingLog) {
        // First scan of the day - TIME IN
        $stmt = $conn->prepare("
            INSERT INTO attendance_logs (student_id, date, time_in) 
            VALUES (:student_id, :date, :time)
        ");
        $stmt->execute([
            'student_id' => $student['student_id'],
            'date' => $today,
            'time' => date('H:i:s')
        ]);
        $isTimeIn = true;
        $action = 'TIME IN';
        $time = date('H:i:s');
        
    } else if ($existingLog['time_in'] && !$existingLog['time_out']) {
        // Already timed in, now TIME OUT
        $stmt = $conn->prepare("
            UPDATE attendance_logs 
            SET time_out = :time 
            WHERE attendance_id = :id
        ");
        $stmt->execute([
            'time' => date('H:i:s'),
            'id' => $existingLog['attendance_id']
        ]);
        $isTimeOut = true;
        $action = 'TIME OUT';
        $time = date('H:i:s');
        
    } else {
        // Already timed in and out - don't allow more scans today
        sendErrorResponse('Student has already completed attendance for today (Time In: ' . 
                  $existingLog['time_in'] . ', Time Out: ' . $existingLog['time_out'] . ')', 409);
    }
    
    // Send SMS to guardian
    $smsMessage = "{$student['student_name']} - {$action} at " . date('g:i A');
    $smsSent = sendSMS($student['guardian_cellnum'], $smsMessage, $conn, $student['guardian_id'], $student['student_id']);
    
    // Prepare response for ESP32/Arduino (for LED display)
    sendSuccessResponse("Attendance logged: {$action}",[
        'student_id' => $student['student_id'],
        'student_name' => $student['student_name'],
        'action' => $action,
        'time' => $time,
        'date' => $today,
        'sms_sent' => $smsSent,
        'display_message' => "{$student['student_name']}\n{$action}\n{$time}"
    ]);
    
} catch (PDOException $e) {
    error_log("NFC Scan Error: " . $e->getMessage());
    sendErrorResponse('Failed to process attendance', 500);
}

/**
 * Send SMS using Twilio
 * NOTE: You'll need to add your Twilio credentials
 */
function sendSMS($phoneNumber, $message, $conn, $guardianId, $studentId) {
    // TODO: Implement actual Twilio SMS sending
    // For now, just log to SMS logs table
    
    try {
        $stmt = $conn->prepare("
            INSERT INTO sms_logs (guardian_id, student_id, sent_at, status) 
            VALUES (:guardian_id, :student_id, NOW(), 'PENDING')
        ");
        $stmt->execute([
            'guardian_id' => $guardianId,
            'student_id' => $studentId
        ]);
        
        // Log for testing
        error_log("SMS would be sent to {$phoneNumber}: {$message}");
        
        return true;
    } catch (Exception $e) {
        error_log("SMS Log Error: " . $e->getMessage());
        return false;
    }
}
?>
