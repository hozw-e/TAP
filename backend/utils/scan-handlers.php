<?php
/**
 * NFC Scan Handlers
 *
 * Decomposes the scan flow that used to live inline in api/nfc/scan.php into
 * focused, testable units. Behaviour is unchanged — each handler performs the
 * same DB writes and terminates the request with the same response as before.
 *
 * Handlers that reach a terminal outcome call sendSuccessResponse()/
 * sendErrorResponse(), which emit JSON and exit(). The orchestrator (scan.php)
 * calls them in the same order the original linear code ran.
 *
 * Depends on (already required by scan.php):
 *   response.php, attendance-helpers.php, NotificationService.php,
 *   session-counter.php, auto-archiver.php, activity-logger.php
 */

/**
 * Persist a processed scan outcome into temp_nfc_scans.action_result so the
 * polling kiosk frontend can read it. Centralizes the ~10 copy-pasted UPDATEs.
 *
 * @param PDO    $conn
 * @param int    $scanId  temp_nfc_scans.id for the current scan row
 * @param array  $data    the action_result payload (will be JSON-encoded)
 */
function storeScanResult($conn, $scanId, array $data) {
    $stmt = $conn->prepare("UPDATE temp_nfc_scans SET action_result = :result WHERE id = :id");
    $stmt->execute([':result' => json_encode($data), ':id' => $scanId]);
}

/**
 * Publish an attendance event to the WebSocket server for real-time broadcast.
 * Fire-and-forget: errors are logged but never delay the scan response.
 */
function publishAttendanceEvent($eventData) {
    $wsUrl = getenv('WEBSOCKET_SERVER_URL') ?: 'https://tap-web-socket.up.railway.app';
    $target = $wsUrl . '/internal/event';

    // Diagnostic: log the target URL so we can confirm WHERE scan.php is publishing.
    error_log("[WS-PUBLISH] POST -> {$target}");

    $ch = curl_init($target);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($eventData),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        // Timeouts sized for a cross-service call over the public internet + TLS.
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_RETURNTRANSFER => true,
    ]);
    $body = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    if (curl_errno($ch)) {
        // Diagnostic: surface the exact cURL failure reason + the URL that failed.
        error_log("[WS-PUBLISH] FAILED -> {$target} : " . curl_error($ch));
    } else {
        // Diagnostic: confirm success + what the WS server replied.
        error_log("[WS-PUBLISH] OK -> {$target} : HTTP {$httpCode} : {$body}");
    }
    curl_close($ch);
}

/**
 * Read the current scanner mode ('attendance' | 'assign' | 'visitor').
 * Defaults to 'attendance' if the row/table is unavailable.
 */
function getScannerMode($conn) {
    try {
        $modeStmt = $conn->query("SELECT mode FROM scanner_mode WHERE id = 1 LIMIT 1");
        $modeRow = $modeStmt->fetch(PDO::FETCH_ASSOC);
        if ($modeRow) {
            return $modeRow['mode'];
        }
    } catch (Exception $e) {
        // Table might not exist yet, default to attendance
    }
    return 'attendance';
}

/**
 * VISITOR CHECK-OUT: tag is linked to an active visitor session.
 * Terminates the request.
 */
function handleVisitorCheckout($conn, $nfcTag, $uid, $scanId) {
    $visitId = $nfcTag['visitor_session_id'];

    $stmt = $conn->prepare("
        SELECT visit_id, name, time_in
        FROM visitors
        WHERE visit_id = :visit_id AND time_out IS NULL
    ");
    $stmt->execute([':visit_id' => $visitId]);
    $visitor = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$visitor) {
        // Orphaned visitor_session_id — reset tag.
        $stmt = $conn->prepare("UPDATE nfc_tags SET visitor_session_id = NULL WHERE nfctag_id = :nfctag_id");
        $stmt->execute([':nfctag_id' => $nfcTag['nfctag_id']]);
        sendErrorResponse('Visitor session not found or already checked out', 404);
    }

    $now = date('H:i:s');

    $stmt = $conn->prepare("UPDATE visitors SET time_out = :time_out WHERE visit_id = :visit_id");
    $stmt->execute([':time_out' => $now, ':visit_id' => $visitId]);

    // Release the NFC tag back to unassigned status.
    $stmt = $conn->prepare("UPDATE nfc_tags SET visitor_session_id = NULL WHERE nfctag_id = :nfctag_id");
    $stmt->execute([':nfctag_id' => $nfcTag['nfctag_id']]);

    logActivity('CHECK_OUT', 'VISITOR', $visitor['name'], "Visit ID: {$visitId}, Time out: {$now}", 'System');

    $resultData = [
        'status'   => 'visitor',
        'action'   => 'visitor_checkout',
        'uid'      => $uid,
        'visit_id' => (int)$visitor['visit_id'],
        'name'     => $visitor['name'],
        'time_out' => $now,
        'message'  => 'Visitor checked out: ' . $visitor['name'],
    ];

    storeScanResult($conn, $scanId, $resultData);
    sendSuccessResponse('Visitor checked out successfully', $resultData);
}

/**
 * Look up the student's course schedule for today, or null if none.
 */
function lookupSchedule($conn, $studentCourse) {
    if (!$studentCourse) {
        return null;
    }
    $dayOfWeek = date('l'); // e.g. 'Monday'
    $stmtSched = $conn->prepare("
        SELECT start_time, end_time, grace_period, total_hours
        FROM course_schedules
        WHERE course_name = :course_name
          AND day_of_week = :day_of_week
        ORDER BY start_time ASC
        LIMIT 1
    ");
    $stmtSched->execute([
        ':course_name' => $studentCourse,
        ':day_of_week' => $dayOfWeek,
    ]);
    return $stmtSched->fetch(PDO::FETCH_ASSOC) ?: null;
}

/**
 * STUDENT CHECK-OUT path: time-out gate, hour-requirement gate, the
 * time_out/session-decrement/auto-archive transaction, and notification.
 *
 * Returns an array: ['action','actionMessage','remainingSessions','notifResult'].
 * Terminates the request itself when a gate denies the check-out.
 */
function handleStudentCheckOut($conn, $ctx, $schedule, $openRecord) {
    $uid         = $ctx['uid'];
    $scanId      = $ctx['scanId'];
    $studentId   = $ctx['studentId'];
    $studentName = $ctx['studentName'];
    $studentCourse = $ctx['studentCourse'];
    $guardianId  = $ctx['guardianId'];
    $now         = $ctx['now'];
    $displayTime = $ctx['displayTime'];

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
            storeScanResult($conn, $scanId, $denialData);
            sendSuccessResponse('Check-out denied: session not ended', $denialData);
        }
    }
    // --- End Time_Out_Gate ---

    // --- Hour_Requirement_Gate: deny if minimum session duration not met ---
    $totalHours = $schedule ? ($schedule['total_hours'] ?? null) : null;
    $endTime   = $schedule ? $schedule['end_time'] : null;
    $startTime = $schedule ? $schedule['start_time'] : null;
    $timeIn    = $openRecord['time_in'];
    if ($totalHours !== null) {
        $totalHours = (float) $totalHours;
    }

    $hourCheck = checkHourRequirement($timeIn ?? '', $now, $totalHours, $endTime, $startTime);

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
        try {
            storeScanResult($conn, $scanId, $denialData);
        } catch (Exception $e) {
            error_log("Failed to store hour requirement denial in temp_nfc_scans: " . $e->getMessage());
        }
        sendSuccessResponse('Check-out denied: minimum session duration not met', $denialData);
    }
    // --- End Hour_Requirement_Gate ---

    // --- Transaction: time_out update + session decrement + auto-archive ---
    $remainingSessions = null;
    $conn->beginTransaction();
    try {
        $stmt = $conn->prepare("
            UPDATE attendance_logs SET time_out = :time_out WHERE attendance_id = :attendance_id
        ");
        $stmt->execute([
            ':time_out'      => $now,
            ':attendance_id' => $openRecord['attendance_id'],
        ]);

        if (!isSessionDecremented($conn, $openRecord['attendance_id'])) {
            $remainingSessions = decrementSession($conn, (int)$studentId, (int)$openRecord['attendance_id']);
            if ($remainingSessions === 0) {
                autoArchiveStudent($conn, (int)$studentId, $studentName);
            }
        } else {
            $stmtSess = $conn->prepare("SELECT remaining_sessions FROM students WHERE student_id = :sid");
            $stmtSess->execute([':sid' => $studentId]);
            $remainingSessions = (int)$stmtSess->fetch(PDO::FETCH_ASSOC)['remaining_sessions'];
        }

        $conn->commit();
    } catch (Exception $e) {
        $conn->rollBack();
        error_log("Check-out transaction failed: " . $e->getMessage());
        // Generic client message — do not leak exception details.
        sendErrorResponse('Check-out failed. Please try again.', 500);
    }
    // --- End transaction ---

    $action        = 'check_out';
    $actionMessage = 'Checked out: ' . $studentName;

    // Store result BEFORE notification so the kiosk picks it up immediately.
    $resultDataArray = [
        'status'            => 'assigned',
        'action'            => $action,
        'uid'               => $uid,
        'student_id'        => $studentId,
        'student_name'      => $studentName,
        'notification_sent' => false,
        'message'           => $actionMessage,
    ];
    if (isset($remainingSessions)) {
        $resultDataArray['remaining_sessions'] = $remainingSessions;
    }
    storeScanResult($conn, $scanId, $resultDataArray);

    publishAttendanceEvent([
        'student_id'      => $studentId,
        'student_name'    => $studentName,
        'action'          => 'check_out',
        'timestamp'       => date('c'),
        'course'          => $studentCourse,
        'attendance_flag' => null,
    ]);

    $notifResult = null;
    if ($guardianId) {
        try {
            $ns = new NotificationService();
            $message = NotificationService::formatCheckOutMessage($studentName, $displayTime);
            $notifResult = $ns->notify((int)$guardianId, (int)$studentId, 'check_out', $message, $conn);

            $stmt = $conn->prepare("
                UPDATE attendance_logs
                SET msg_out_channel = :msg_out_channel, msg_out_success = :msg_out_success
                WHERE attendance_id = :attendance_id
            ");
            $stmt->execute([
                ':msg_out_channel' => $notifResult['channel'],
                ':msg_out_success' => $notifResult['success'] ? 1 : 0,
                ':attendance_id'   => $openRecord['attendance_id'],
            ]);
        } catch (Exception $e) {
            error_log("Check-out notification failed: " . $e->getMessage());
        }
    }

    return [
        'action'            => $action,
        'actionMessage'     => $actionMessage,
        'remainingSessions' => $remainingSessions,
        'notifResult'       => $notifResult,
    ];
}

/**
 * STUDENT CHECK-IN path: schedule-aware validation, insert, attendance flag,
 * and notification. Returns ['action','actionMessage','notifResult'].
 * Terminates the request itself when a gate denies the check-in.
 */
function handleStudentCheckIn($conn, $ctx, $schedule) {
    $uid         = $ctx['uid'];
    $scanId      = $ctx['scanId'];
    $studentId   = $ctx['studentId'];
    $studentName = $ctx['studentName'];
    $studentCourse = $ctx['studentCourse'];
    $guardianId  = $ctx['guardianId'];
    $today       = $ctx['today'];
    $now         = $ctx['now'];
    $displayTime = $ctx['displayTime'];

    // --- Schedule-aware check-in validation ---
    if ($schedule) {
        $timeValidation = validateTimeInWindow($now, $schedule['start_time'], $schedule['end_time']);

        if ($timeValidation === 'too_early') {
            $denialData = [
                'status'             => 'denied',
                'action'             => 'check_in_denied',
                'uid'                => $uid,
                'student_id'         => $studentId,
                'student_name'       => $studentName,
                'message'            => 'Session has not started yet. Too early to check in.',
                'session_start_time' => $schedule['start_time'],
            ];
            storeScanResult($conn, $scanId, $denialData);
            sendSuccessResponse('Check-in denied: too early', $denialData);
        }

        if ($timeValidation === 'session_ended') {
            $denialData = [
                'status'           => 'denied',
                'action'           => 'check_in_denied',
                'uid'              => $uid,
                'student_id'       => $studentId,
                'student_name'     => $studentName,
                'message'          => 'Session has already ended.',
                'session_end_time' => $schedule['end_time'],
            ];
            storeScanResult($conn, $scanId, $denialData);
            sendSuccessResponse('Check-in denied: session ended', $denialData);
        }
    }
    // --- End schedule-aware check-in validation ---

    // Insert attendance record (allowed: either schedule validated or no schedule).
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

    // Compute and store attendance flag if schedule exists.
    $attendanceFlag = null;
    if ($schedule) {
        $attendanceFlag = computeAttendanceFlag(
            $now,
            $schedule['start_time'],
            (int)$schedule['grace_period'],
            $schedule['end_time']
        );
        $stmt = $conn->prepare("
            UPDATE attendance_logs SET attendance_flag = :flag WHERE attendance_id = :attendance_id
        ");
        $stmt->execute([':flag' => $attendanceFlag, ':attendance_id' => $newAttendanceId]);
    }

    $action        = 'check_in';
    $actionMessage = 'Checked in: ' . $studentName;

    // Store result BEFORE notification so the kiosk picks it up immediately.
    $resultDataArray = [
        'status'            => 'assigned',
        'action'            => $action,
        'uid'               => $uid,
        'student_id'        => $studentId,
        'student_name'      => $studentName,
        'notification_sent' => false,
        'message'           => $actionMessage,
    ];
    storeScanResult($conn, $scanId, $resultDataArray);

    publishAttendanceEvent([
        'student_id'      => $studentId,
        'student_name'    => $studentName,
        'action'          => 'check_in',
        'timestamp'       => date('c'),
        'course'          => $studentCourse,
        'attendance_flag' => $attendanceFlag,
    ]);

    $notifResult = null;
    if ($guardianId) {
        try {
            $ns = new NotificationService();
            $message = NotificationService::formatCheckInMessage($studentName, $displayTime);
            $notifResult = $ns->notify((int)$guardianId, (int)$studentId, 'check_in', $message, $conn);

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
        } catch (Exception $e) {
            error_log("Check-in notification failed: " . $e->getMessage());
        }
    }

    return [
        'action'        => $action,
        'actionMessage' => $actionMessage,
        'notifResult'   => $notifResult,
    ];
}

/**
 * UNASSIGNED CARD: respond according to scanner mode. Terminates the request.
 */
function handleUnassignedCard($conn, $scannerMode, $uid, $scanId) {
    if ($scannerMode === 'assign') {
        $payload = [
            'status'  => 'unassigned',
            'uid'     => $uid,
            'message' => 'NFC tag stored for assignment',
        ];
        storeScanResult($conn, $scanId, $payload);
        sendSuccessResponse('NFC tag scanned successfully', $payload);
    } elseif ($scannerMode === 'visitor') {
        $payload = [
            'status'  => 'unassigned',
            'uid'     => $uid,
            'message' => 'Ready for visitor check-in',
        ];
        storeScanResult($conn, $scanId, $payload);
        sendSuccessResponse('NFC tag scanned (visitor mode)', $payload);
    } else {
        $payload = [
            'status'  => 'error_unassigned',
            'uid'     => $uid,
            'message' => 'Unregistered card',
        ];
        storeScanResult($conn, $scanId, $payload);
        sendSuccessResponse('Unregistered NFC card', $payload);
    }
}
?>
