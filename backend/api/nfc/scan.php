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
require_once '../../utils/attendance-helpers.php';
require_once '../../utils/NotificationService.php';
require_once '../../utils/session-counter.php';
require_once '../../utils/auto-archiver.php';
require_once '../../utils/activity-logger.php';

/**
 * Publish an attendance event to the WebSocket server for real-time broadcasting.
 * Fire-and-forget: errors are logged but never delay the scan response.
 */
function publishAttendanceEvent($eventData) {
    $wsUrl = getenv('WEBSOCKET_SERVER_URL') ?: 'http://localhost:3001';
    $ch = curl_init($wsUrl . '/internal/event');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($eventData),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT_MS => 200,
        CURLOPT_CONNECTTIMEOUT_MS => 100,
        CURLOPT_RETURNTRANSFER => true,
    ]);
    $result = curl_exec($ch);
    if (curl_errno($ch)) {
        error_log("WebSocket publish failed: " . curl_error($ch));
    }
    curl_close($ch);
}

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
            action_result JSON DEFAULT NULL,
            scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            consumed BOOLEAN DEFAULT FALSE,
            INDEX idx_consumed (consumed),
            INDEX idx_scanned_at (scanned_at)
        )
    ");

    // Add action_result column if it doesn't exist (for tables created before this column was introduced)
    try {
        $conn->exec("ALTER TABLE temp_nfc_scans ADD COLUMN action_result JSON DEFAULT NULL");
    } catch (Exception $e) {
        // Ignore — column likely already exists
    }
    
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
    
    // Check if this UID is already assigned to a student OR linked to a visitor session
    $stmt = $conn->prepare("
        SELECT 
            n.nfctag_id,
            n.student_id,
            n.visitor_session_id,
            s.student_name,
            s.guardian_id,
            s.student_course AS course,
            s.is_archived
        FROM nfc_tags n
        LEFT JOIN students s ON n.student_id = s.student_id
        WHERE n.uid = :uid
    ");
    
    $stmt->execute([':uid' => $uid]);
    $nfcTag = $stmt->fetch();
    
    // Fetch scanner mode early — needed by both the student and unassigned branches
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
    
    // --- VISITOR CHECK-OUT FLOW ---
    if ($nfcTag && $nfcTag['visitor_session_id']) {
        // This NFC tag is currently linked to an active visitor session → check out the visitor
        $visitId = $nfcTag['visitor_session_id'];
        
        // Get visitor details
        $stmt = $conn->prepare("
            SELECT visit_id, name, time_in
            FROM visitors
            WHERE visit_id = :visit_id AND time_out IS NULL
        ");
        $stmt->execute([':visit_id' => $visitId]);
        $visitor = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($visitor) {
            $now = date('H:i:s');
            
            // Record time_out
            $stmt = $conn->prepare("
                UPDATE visitors
                SET time_out = :time_out
                WHERE visit_id = :visit_id
            ");
            $stmt->execute([
                ':time_out' => $now,
                ':visit_id' => $visitId,
            ]);
            
            // Release the NFC tag back to unassigned status
            $stmt = $conn->prepare("
                UPDATE nfc_tags
                SET visitor_session_id = NULL
                WHERE nfctag_id = :nfctag_id
            ");
            $stmt->execute([':nfctag_id' => $nfcTag['nfctag_id']]);
            
            logActivity('CHECK_OUT', 'VISITOR', $visitor['name'], "Visit ID: {$visitId}, Time out: {$now}", 'System');
            
            $resultData = [
                'status' => 'visitor',
                'action' => 'visitor_checkout',
                'uid' => $uid,
                'visit_id' => (int)$visitor['visit_id'],
                'name' => $visitor['name'],
                'time_out' => $now,
                'message' => 'Visitor checked out: ' . $visitor['name'],
            ];
            
            // Store in temp_nfc_scans
            $stmtUpdate = $conn->prepare("UPDATE temp_nfc_scans SET action_result = :result WHERE id = :id");
            $stmtUpdate->execute([':result' => json_encode($resultData), ':id' => $scanInsertId]);
            
            sendSuccessResponse('Visitor checked out successfully', $resultData);
        } else {
            // Orphaned visitor_session_id — reset tag
            $stmt = $conn->prepare("UPDATE nfc_tags SET visitor_session_id = NULL WHERE nfctag_id = :nfctag_id");
            $stmt->execute([':nfctag_id' => $nfcTag['nfctag_id']]);
            
            sendErrorResponse('Visitor session not found or already checked out', 404);
        }
    }
    // --- END VISITOR CHECK-OUT FLOW ---
    
    if ($nfcTag && $nfcTag['student_id']) {
        // --- Student card in visitor mode: block it ---
        if ($scannerMode === 'visitor') {
            $resultData = json_encode([
                'status'  => 'student_card',
                'uid'     => $uid,
                'message' => 'This card belongs to a student',
            ]);
            $stmtUpdate = $conn->prepare("UPDATE temp_nfc_scans SET action_result = :result WHERE id = :id");
            $stmtUpdate->execute([':result' => $resultData, ':id' => $scanInsertId]);
            sendSuccessResponse('Student card scanned in visitor mode', [
                'status'  => 'student_card',
                'uid'     => $uid,
                'message' => 'This card belongs to a student',
            ]);
        }
        // --- End student card in visitor mode ---
        $studentId        = $nfcTag['student_id'];
        $studentName      = $nfcTag['student_name'];
        $studentCourse    = $nfcTag['course'];
        $guardianId       = $nfcTag['guardian_id'];
        $today            = date('Y-m-d');
        $now              = date('H:i:s');
        $displayTime      = date('h:i A'); // e.g. "02:30 PM"

        // --- Archived student gate: deny all attendance for archived students ---
        if ($nfcTag['is_archived'] == 1) {
            $denialData = [
                'status'      => 'denied',
                'action'      => 'archived_denied',
                'uid'         => $uid,
                'student_id'  => $studentId,
                'student_name' => $studentName,
                'message'     => 'Student has completed all sessions',
                'timestamp'   => date('c'),
            ];

            $stmtUpdate = $conn->prepare("UPDATE temp_nfc_scans SET action_result = :result WHERE id = :id");
            $stmtUpdate->execute([':result' => json_encode($denialData), ':id' => $scanInsertId]);

            sendSuccessResponse('Attendance denied: student archived', $denialData);
        }
        // --- End archived student gate ---

        // --- Schedule lookup (used by both check-in and check-out paths) ---
        $schedule = null;
        $dayOfWeek = date('l'); // e.g. 'Monday'
        if ($studentCourse) {
            $stmtSched = $conn->prepare("
                SELECT start_time, end_time, grace_period, total_hours
                FROM course_schedules
                WHERE course_name = :course_name
                  AND day_of_week = :day_of_week
                ORDER BY start_time ASC
                LIMIT 1
            ");
            $stmtSched->execute([
                ':course_name'  => $studentCourse,
                ':day_of_week'  => $dayOfWeek,
            ]);
            $schedule = $stmtSched->fetch(PDO::FETCH_ASSOC) ?: null;
        }
        // --- End schedule lookup ---

        // Check if student already has an open attendance record today
        $stmt = $conn->prepare("
            SELECT attendance_id, time_in
            FROM attendance_logs
            WHERE student_id = :student_id
              AND date = :date
              AND time_out IS NULL
            LIMIT 1
        ");
        $stmt->execute([':student_id' => $studentId, ':date' => $today]);
        $openRecord = $stmt->fetch(PDO::FETCH_ASSOC);

        $notifResult = null;

        if ($openRecord) {
            // Student is checking OUT — enforce Time_Out_Gate if schedule exists

            // --- Time_Out_Gate: deny check-out before session end_time ---
            if ($schedule) {
                if (!isTimeOutAllowed($now, $schedule['end_time'])) {
                    $remainingFormatted = formatRemainingTime($now, $schedule['end_time']);
                    error_log("Check-out denied for $studentName: session ends at {$schedule['end_time']}, remaining: $remainingFormatted");

                    $denialData = [
                        'status'           => 'denied',
                        'action'           => 'check_out_denied',
                        'uid'              => $uid,
                        'student_id'       => $studentId,
                        'student_name'     => $studentName,
                        'message'          => "Cannot check out yet. Session ends at {$schedule['end_time']}. Remaining: $remainingFormatted",
                        'session_end_time' => $schedule['end_time'],
                    ];

                    // Store denial in temp_nfc_scans.action_result
                    $stmtUpdate = $conn->prepare("UPDATE temp_nfc_scans SET action_result = :result WHERE id = :id");
                    $stmtUpdate->execute([':result' => json_encode($denialData), ':id' => $scanInsertId]);

                    sendSuccessResponse('Check-out denied: session not ended', $denialData);
                }
            }
            // --- End Time_Out_Gate ---

            // --- Hour_Requirement_Gate: deny check-out if minimum session duration not met ---
            $totalHours = $schedule ? (isset($schedule['total_hours']) ? $schedule['total_hours'] : null) : null;
            $endTime = $schedule ? $schedule['end_time'] : null;
            $timeIn = $openRecord['time_in'];

            if ($totalHours !== null) {
                $totalHours = (float) $totalHours;
            }

            $hourCheck = checkHourRequirement(
                $timeIn ?? '',
                $now,
                $totalHours,
                $endTime
            );

            if (!$hourCheck['allowed']) {
                error_log("Check-out denied for $studentName: hour requirement not met. Rendered: {$hourCheck['rendered_minutes']} min, Required: {$hourCheck['minimum_minutes']} min, Remaining: {$hourCheck['remaining_minutes']} min");

                $denialData = [
                    'student_id'               => (int) $studentId,
                    'student_name'             => $studentName,
                    'uid'                      => $uid,
                    'timestamp'                => date('c'),
                    'status'                   => 'denied',
                    'action'                   => 'hour_requirement_denied',
                    'minimum_required_minutes' => $hourCheck['minimum_minutes'],
                    'rendered_minutes'         => $hourCheck['rendered_minutes'],
                    'remaining_minutes'        => $hourCheck['remaining_minutes'],
                ];

                // Store denial in temp_nfc_scans.action_result
                try {
                    $stmtUpdate = $conn->prepare("UPDATE temp_nfc_scans SET action_result = :result WHERE id = :id");
                    $stmtUpdate->execute([':result' => json_encode($denialData), ':id' => $scanInsertId]);
                } catch (Exception $e) {
                    error_log("Failed to store hour requirement denial in temp_nfc_scans: " . $e->getMessage());
                }

                sendSuccessResponse('Check-out denied: minimum session duration not met', $denialData);
            }
            // --- End Hour_Requirement_Gate ---

            // If no schedule or time-out is allowed, proceed with check-out

            // --- Begin transaction: time_out update + session decrement + auto-archive ---
            $conn->beginTransaction();
            try {
                $stmt = $conn->prepare("
                    UPDATE attendance_logs
                    SET time_out = :time_out
                    WHERE attendance_id = :attendance_id
                ");
                $stmt->execute([
                    ':time_out'      => $now,
                    ':attendance_id' => $openRecord['attendance_id'],
                ]);

                // --- Session decrement + auto-archive ---
                $remainingSessions = null;
                if (!isSessionDecremented($conn, $openRecord['attendance_id'])) {
                    $remainingSessions = decrementSession($conn, (int)$studentId, (int)$openRecord['attendance_id']);
                    if ($remainingSessions === 0) {
                        autoArchiveStudent($conn, (int)$studentId, $studentName);
                    }
                } else {
                    // Already decremented — just fetch current value
                    $stmtSess = $conn->prepare("SELECT remaining_sessions FROM students WHERE student_id = :sid");
                    $stmtSess->execute([':sid' => $studentId]);
                    $remainingSessions = (int)$stmtSess->fetch(PDO::FETCH_ASSOC)['remaining_sessions'];
                }
                // --- End session decrement ---

                $conn->commit();
            } catch (Exception $e) {
                $conn->rollBack();
                error_log("Check-out transaction failed: " . $e->getMessage());
                sendErrorResponse('Check-out failed: ' . $e->getMessage(), 500);
            }
            // --- End transaction ---

            $action        = 'check_out';
            $actionMessage = 'Checked out: ' . $studentName;

            // Publish real-time attendance event to WebSocket server (fire-and-forget, outside transaction)
            publishAttendanceEvent([
                'student_id' => $studentId,
                'student_name' => $studentName,
                'action' => 'check_out',
                'timestamp' => date('c'),
                'course' => $studentCourse,
                'attendance_flag' => null,
            ]);

            // Send check-out notification to guardian via NotificationService
            if ($guardianId) {
                $ns = new NotificationService();

                $message = NotificationService::formatCheckOutMessage($studentName, $displayTime);
                $notifResult = $ns->notify((int)$guardianId, (int)$studentId, 'check_out', $message, $conn);

                // Update attendance_logs with msg_channel and msg_success
                $stmt = $conn->prepare("
                    UPDATE attendance_logs
                    SET msg_channel = :msg_channel, msg_success = :msg_success
                    WHERE attendance_id = :attendance_id
                ");
                $stmt->execute([
                    ':msg_channel'   => $notifResult['channel'],
                    ':msg_success'   => $notifResult['success'] ? 1 : 0,
                    ':attendance_id' => $openRecord['attendance_id'],
                ]);
            }
        } else {
            // Student is checking IN

            // --- Schedule-aware check-in validation (Task 3.2) ---
            if ($schedule) {
                $timeValidation = validateTimeInWindow($now, $schedule['start_time'], $schedule['end_time']);

                if ($timeValidation === 'too_early') {
                    // Deny check-in: session has not started yet
                    $denialData = [
                        'status'             => 'denied',
                        'action'             => 'check_in_denied',
                        'uid'                => $uid,
                        'student_id'         => $studentId,
                        'student_name'       => $studentName,
                        'message'            => 'Session has not started yet. Too early to check in.',
                        'session_start_time' => $schedule['start_time'],
                    ];

                    $stmtUpdate = $conn->prepare("UPDATE temp_nfc_scans SET action_result = :result WHERE id = :id");
                    $stmtUpdate->execute([':result' => json_encode($denialData), ':id' => $scanInsertId]);

                    sendSuccessResponse('Check-in denied: too early', $denialData);
                }

                if ($timeValidation === 'session_ended') {
                    // Deny check-in: session has already ended
                    $denialData = [
                        'status'           => 'denied',
                        'action'           => 'check_in_denied',
                        'uid'              => $uid,
                        'student_id'       => $studentId,
                        'student_name'     => $studentName,
                        'message'          => 'Session has already ended.',
                        'session_end_time' => $schedule['end_time'],
                    ];

                    $stmtUpdate = $conn->prepare("UPDATE temp_nfc_scans SET action_result = :result WHERE id = :id");
                    $stmtUpdate->execute([':result' => json_encode($denialData), ':id' => $scanInsertId]);

                    sendSuccessResponse('Check-in denied: session ended', $denialData);
                }
            }
            // --- End schedule-aware check-in validation ---

            // Insert attendance record (allowed: either schedule validated or no schedule)
            $stmt = $conn->prepare("
                INSERT INTO attendance_logs (student_id, date, time_in)
                VALUES (:student_id, :date, :time_in)
            ");
            $stmt->execute([
                ':student_id' => $studentId,
                ':date'       => $today,
                ':time_in'    => $now,
            ]);

            $newAttendanceId = $conn->lastInsertId();

            // Compute and store attendance flag if schedule exists
            if ($schedule) {
                $attendanceFlag = computeAttendanceFlag(
                    $now,
                    $schedule['start_time'],
                    (int)$schedule['grace_period'],
                    $schedule['end_time']
                );

                $stmt = $conn->prepare("
                    UPDATE attendance_logs
                    SET attendance_flag = :flag
                    WHERE attendance_id = :attendance_id
                ");
                $stmt->execute([
                    ':flag'          => $attendanceFlag,
                    ':attendance_id' => $newAttendanceId,
                ]);
            }

            $action        = 'check_in';
            $actionMessage = 'Checked in: ' . $studentName;

            // Publish real-time attendance event to WebSocket server
            publishAttendanceEvent([
                'student_id' => $studentId,
                'student_name' => $studentName,
                'action' => 'check_in',
                'timestamp' => date('c'),
                'course' => $studentCourse,
                'attendance_flag' => $attendanceFlag ?? null,
            ]);

            // Send check-in notification to guardian via NotificationService
            if ($guardianId) {
                $ns = new NotificationService();

                $message = NotificationService::formatCheckInMessage($studentName, $displayTime);
                $notifResult = $ns->notify((int)$guardianId, (int)$studentId, 'check_in', $message, $conn);

                // Update attendance_logs with msg_channel and msg_success
                $stmt = $conn->prepare("
                    UPDATE attendance_logs
                    SET msg_channel = :msg_channel, msg_success = :msg_success
                    WHERE attendance_id = :attendance_id
                ");
                $stmt->execute([
                    ':msg_channel'   => $notifResult['channel'],
                    ':msg_success'   => $notifResult['success'] ? 1 : 0,
                    ':attendance_id' => $newAttendanceId,
                ]);
            }
        }

        $notificationSent = isset($notifResult) ? $notifResult['success'] : false;
        error_log("Attendance recorded: $actionMessage | Notification sent: " . ($notificationSent ? 'yes' : 'no'));

        // Store action result in temp_nfc_scans
        $resultDataArray = [
            'status'             => 'assigned',
            'action'             => $action,
            'uid'                => $uid,
            'student_id'         => $studentId,
            'student_name'       => $studentName,
            'notification_sent'  => $notificationSent,
            'message'            => $actionMessage,
        ];
        if (isset($remainingSessions)) {
            $resultDataArray['remaining_sessions'] = $remainingSessions;
        }
        $resultData = json_encode($resultDataArray);
        $stmtUpdate = $conn->prepare("UPDATE temp_nfc_scans SET action_result = :result WHERE id = :id");
        $stmtUpdate->execute([':result' => $resultData, ':id' => $scanInsertId]);

        $responseData = [
            'status'             => 'assigned',
            'action'             => $action,
            'uid'                => $uid,
            'student_id'         => $studentId,
            'student_name'       => $studentName,
            'notification_sent'  => $notificationSent,
            'message'            => $actionMessage,
        ];
        if (isset($remainingSessions)) {
            $responseData['remaining_sessions'] = $remainingSessions;
        }
        sendSuccessResponse('NFC tag scanned (assigned)', $responseData);
    } else {
        // Not assigned — check scanner mode to determine response

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
        } elseif ($scannerMode === 'visitor') {
            // Visitor mode — unassigned/unknown card is valid for visitor check-in
            $resultData = json_encode([
                'status' => 'unassigned',
                'uid' => $uid,
                'message' => 'Ready for visitor check-in'
            ]);
            $stmtUpdate = $conn->prepare("UPDATE temp_nfc_scans SET action_result = :result WHERE id = :id");
            $stmtUpdate->execute([':result' => $resultData, ':id' => $scanInsertId]);

            sendSuccessResponse('NFC tag scanned (visitor mode)', [
                'status' => 'unassigned',
                'uid' => $uid,
                'message' => 'Ready for visitor check-in'
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
