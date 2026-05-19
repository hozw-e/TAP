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
    
    // Insert the new scan (action_result will be updated after processing)
    $stmt = $conn->prepare("
        INSERT INTO temp_nfc_scans (uid, scanned_at, consumed) 
        VALUES (:uid, NOW(), FALSE)
    ");
    
    $stmt->execute([':uid' => $uid]);
    $scanInsertId = $conn->lastInsertId();
    
    // Clean up old scans (older than 1 minute)
    $conn->exec("DELETE FROM temp_nfc_scans WHERE scanned_at < DATE_SUB(NOW(), INTERVAL 1 MINUTE)");
    
    error_log("NFC Scan stored in database: " . $uid);
    
    // Check if this UID is already assigned to a student
    $stmt = $conn->prepare("
        SELECT 
            n.nfctag_id,
            n.student_id,
            s.student_name,
            g.guardian_cellnum
        FROM nfc_tags n
        LEFT JOIN students s ON n.student_id = s.student_id
        LEFT JOIN guardians g ON s.guardian_id = g.guardian_id
        WHERE n.uid = :uid
    ");
    
    $stmt->execute([':uid' => $uid]);
    $nfcTag = $stmt->fetch();
    
    if ($nfcTag && $nfcTag['student_id']) {
        $studentId        = $nfcTag['student_id'];
        $studentName      = $nfcTag['student_name'];
        $guardianCellnum  = $nfcTag['guardian_cellnum'];
        $today            = date('Y-m-d');
        $now              = date('H:i:s');
        $displayTime      = date('h:i A'); // e.g. "02:30 PM"

        // -----------------------------------------------
        // SMS helper — sends via iProg SMS API
        // -----------------------------------------------
        $sendSMS = function(string $rawNumber, string $message) {
            $apiToken = '67fc73769b9ced49cfa661c6382c5bfa0d7e5449';

            // Convert 09XXXXXXXXX → 639XXXXXXXXX
            $number = $rawNumber;
            if (substr($number, 0, 2) === '09') {
                $number = '63' . substr($number, 1);
            }

            $payload = json_encode([
                'api_token'    => $apiToken,
                'phone_number' => $number,
                'message'      => $message,
            ]);

            $ch = curl_init('https://www.iprogsms.com/api/v1/sms_messages?api_token=' . urlencode($apiToken) . '&message=' . urlencode($message) . '&phone_number=' . urlencode($number));
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);
            $result = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            error_log("SMS to $number — HTTP $httpCode: $result");
            return $httpCode === 200;
        };

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

        $smsSent = false;

        if ($openRecord) {
            // Student is checking OUT — but first check if 1 minute has passed
            
            // Get the time_in from the open record
            $stmt = $conn->prepare("
                SELECT time_in, date
                FROM attendance_logs
                WHERE attendance_id = :attendance_id
            ");
            $stmt->execute([':attendance_id' => $openRecord['attendance_id']]);
            $recordDetails = $stmt->fetch(PDO::FETCH_ASSOC);
            
            // Calculate time difference in seconds
            $timeInDateTime = new DateTime($recordDetails['date'] . ' ' . $recordDetails['time_in']);
            $currentDateTime = new DateTime($today . ' ' . $now);
            $timeDifference = $currentDateTime->getTimestamp() - $timeInDateTime->getTimestamp();
            
            // Check if at least 60 seconds (1 minute) have passed
            if ($timeDifference < 60) {
                $remainingSeconds = 60 - $timeDifference;
                error_log("Check-out denied for $studentName: Only $timeDifference seconds since check-in");
                
                // Store action result in temp_nfc_scans
                $resultData = json_encode([
                    'status' => 'denied',
                    'action' => 'check_out_denied',
                    'uid' => $uid,
                    'student_id' => $studentId,
                    'student_name' => $studentName,
                    'message' => "Please wait $remainingSeconds more seconds before checking out",
                    'time_since_checkin' => $timeDifference,
                    'required_time' => 60
                ]);
                $stmtUpdate = $conn->prepare("UPDATE temp_nfc_scans SET action_result = :result WHERE id = :id");
                $stmtUpdate->execute([':result' => $resultData, ':id' => $scanInsertId]);
                
                sendSuccessResponse('Check-out too soon', [
                    'status' => 'denied',
                    'action' => 'check_out_denied',
                    'uid' => $uid,
                    'student_id' => $studentId,
                    'student_name' => $studentName,
                    'message' => "Please wait $remainingSeconds more seconds before checking out",
                    'time_since_checkin' => $timeDifference,
                    'required_time' => 60
                ]);
            }
            
            // Proceed with check-out if 1 minute has passed
            $stmt = $conn->prepare("
                UPDATE attendance_logs
                SET time_out = :time_out
                WHERE attendance_id = :attendance_id
            ");
            $stmt->execute([
                ':time_out'      => $now,
                ':attendance_id' => $openRecord['attendance_id'],
            ]);

            $action        = 'check_out';
            $actionMessage = 'Checked out: ' . $studentName;

            // Send check-out SMS to guardian
            if ($guardianCellnum) {
                $smsMessage = "Your child $studentName has checked out at $displayTime. - A+ Solutions Dev't Center";
                $smsSent = $sendSMS($guardianCellnum, $smsMessage);

                // Update sms_sent_out in attendance record
                $stmt = $conn->prepare("
                    UPDATE attendance_logs
                    SET sms_sent_out = :sms_sent_out
                    WHERE attendance_id = :attendance_id
                ");
                $stmt->execute([
                    ':sms_sent_out'  => $smsSent ? 1 : 0,
                    ':attendance_id' => $openRecord['attendance_id'],
                ]);
            }
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

            $action        = 'check_in';
            $actionMessage = 'Checked in: ' . $studentName;

            // Send check-in SMS to guardian
            if ($guardianCellnum) {
                $smsMessage = "Your child $studentName has checked in at $displayTime. - A+ Solutions Dev't Center";
                $smsSent = $sendSMS($guardianCellnum, $smsMessage);

                // Update sms_sent_in in attendance record
                $lastInsertId = $conn->lastInsertId();
                $stmt = $conn->prepare("
                    UPDATE attendance_logs
                    SET sms_sent_in = :sms_sent_in
                    WHERE attendance_id = :attendance_id
                ");
                $stmt->execute([
                    ':sms_sent_in'   => $smsSent ? 1 : 0,
                    ':attendance_id' => $lastInsertId,
                ]);
            }
        }

        error_log("Attendance recorded: $actionMessage | SMS sent: " . ($smsSent ? 'yes' : 'no'));

        // Store action result in temp_nfc_scans
        $resultData = json_encode([
            'status'       => 'assigned',
            'action'       => $action,
            'uid'          => $uid,
            'student_id'   => $studentId,
            'student_name' => $studentName,
            'sms_sent'     => $smsSent,
            'message'      => $actionMessage,
        ]);
        $stmtUpdate = $conn->prepare("UPDATE temp_nfc_scans SET action_result = :result WHERE id = :id");
        $stmtUpdate->execute([':result' => $resultData, ':id' => $scanInsertId]);

        sendSuccessResponse('NFC tag scanned (assigned)', [
            'status'       => 'assigned',
            'action'       => $action,
            'uid'          => $uid,
            'student_id'   => $studentId,
            'student_name' => $studentName,
            'sms_sent'     => $smsSent,
            'message'      => $actionMessage,
        ]);
    } else {
        // Not assigned — check scanner mode to determine response
        $scannerMode = 'attendance'; // default
        try {
            $modeStmt = $conn->query("SELECT mode FROM scanner_mode WHERE id = 1 LIMIT 1");
            $modeRow = $modeStmt->fetch(PDO::FETCH_ASSOC);
            if ($modeRow) {
                $scannerMode = $modeRow['mode'];
            }
        } catch (Exception $e) {
            // Table might not exist yet, default to attendance
        }

        if ($scannerMode === 'assign') {
            // Assignment mode — card is expected to be unassigned
            $resultData = json_encode([
                'status' => 'unassigned',
                'uid' => $uid,
                'message' => 'NFC tag stored for assignment'
            ]);
            $stmtUpdate = $conn->prepare("UPDATE temp_nfc_scans SET action_result = :result WHERE id = :id");
            $stmtUpdate->execute([':result' => $resultData, ':id' => $scanInsertId]);

            sendSuccessResponse('NFC tag scanned successfully', [
                'status' => 'unassigned',
                'uid' => $uid,
                'message' => 'NFC tag stored for assignment'
            ]);
        } else {
            // Attendance mode — unassigned card is an error
            $resultData = json_encode([
                'status' => 'error_unassigned',
                'uid' => $uid,
                'message' => 'Unregistered card'
            ]);
            $stmtUpdate = $conn->prepare("UPDATE temp_nfc_scans SET action_result = :result WHERE id = :id");
            $stmtUpdate->execute([':result' => $resultData, ':id' => $scanInsertId]);

            sendSuccessResponse('Unregistered NFC card', [
                'status' => 'error_unassigned',
                'uid' => $uid,
                'message' => 'Unregistered card'
            ]);
        }
    }
    
} catch (PDOException $e) {
    error_log("NFC Scan Error: " . $e->getMessage());
    sendErrorResponse('Failed to store NFC scan', 500);
}
?>