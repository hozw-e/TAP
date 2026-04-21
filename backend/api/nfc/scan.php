<?php
/**
 * NFC Scan API - Database Storage Version
 * POST /api/nfc/scan.php
 * 
 * Stores the scanned UID in database for web interface
 */

date_default_timezone_set('Asia/Manila');

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';

// Get JSON input from ESP32
$input = json_decode(file_get_contents('php://input'), true);

// Validate UID
if (!isset($input['uid']) || empty($input['uid'])) {
    sendErrorResponse('UID is required', 400);
}

$uid = strtoupper(trim($input['uid']));

// Get database connection
$conn = getDBConnection();
if (!$conn) {
    sendErrorResponse('Database connection failed', 500);
}

try {
    // Create a temporary table to store last scan if it doesn't exist
    $conn->exec("
        CREATE TABLE IF NOT EXISTS temp_nfc_scans (
            id INT PRIMARY KEY AUTO_INCREMENT,
            uid VARCHAR(100) NOT NULL,
            scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            consumed BOOLEAN DEFAULT FALSE,
            INDEX idx_consumed (consumed),
            INDEX idx_scanned_at (scanned_at)
        )
    ");
    
    // Insert the new scan
    $stmt = $conn->prepare("
        INSERT INTO temp_nfc_scans (uid, scanned_at, consumed) 
        VALUES (:uid, NOW(), FALSE)
    ");
    
    $stmt->execute([':uid' => $uid]);
    
    // Clean up old scans (older than 1 minute)
    $conn->exec("DELETE FROM temp_nfc_scans WHERE scanned_at < DATE_SUB(NOW(), INTERVAL 1 MINUTE)");
    
    error_log("NFC Scan stored in database: " . $uid);
    
    // Check if this UID is already assigned to a student
    $stmt = $conn->prepare("
        SELECT 
            n.nfctag_id,
            n.student_id,
            s.student_name
        FROM nfc_tags n
        LEFT JOIN students s ON n.student_id = s.student_id
        WHERE n.uid = :uid
    ");
    
    $stmt->execute([':uid' => $uid]);
    $nfcTag = $stmt->fetch();
    
    if ($nfcTag && $nfcTag['student_id']) {
        $studentId = $nfcTag['student_id'];
        $today = date('Y-m-d');
        $now = date('H:i:s');

        // Check if student already has an open attendance record today
        $stmt = $conn->prepare("
            SELECT attendance_id
            FROM attendance_logs
            WHERE student_id = :student_id
              AND date = :date
              AND time_out IS NULL
            LIMIT 1
        ");
        $stmt->execute([':student_id' => $studentId, ':date' => $today]);
        $openRecord = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($openRecord) {
            // Student is checking OUT — fill in time_out
            $stmt = $conn->prepare("
                UPDATE attendance_logs
                SET time_out = :time_out
                WHERE attendance_id = :attendance_id
            ");
            $stmt->execute([
                ':time_out'      => $now,
                ':attendance_id' => $openRecord['attendance_id'],
            ]);

            $action = 'check_out';
            $actionMessage = 'Checked out: ' . $nfcTag['student_name'];
        } else {
            // Student is checking IN — create new record
            $stmt = $conn->prepare("
                INSERT INTO attendance_logs (student_id, date, time_in)
                VALUES (:student_id, :date, :time_in)
            ");
            $stmt->execute([
                ':student_id' => $studentId,
                ':date'       => $today,
                ':time_in'    => $now,
            ]);

            $action = 'check_in';
            $actionMessage = 'Checked in: ' . $nfcTag['student_name'];
        }

        error_log("Attendance recorded: $actionMessage");

        sendSuccessResponse('NFC tag scanned (assigned)', [
            'status'       => 'assigned',
            'action'       => $action,
            'uid'          => $uid,
            'student_id'   => $studentId,
            'student_name' => $nfcTag['student_name'],
            'message'      => $actionMessage,
        ]);
    } else {
        // Not assigned - ready for assignment
        sendSuccessResponse('NFC tag scanned successfully', [
            'status' => 'unassigned',
            'uid' => $uid,
            'message' => 'NFC tag stored for assignment'
        ]);
    }
    
} catch (PDOException $e) {
    error_log("NFC Scan Error: " . $e->getMessage());
    sendErrorResponse('Failed to store NFC scan: ' . $e->getMessage(), 500);
}
?>