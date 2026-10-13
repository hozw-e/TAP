<?php
/**
 * NFC Scan API
 * POST /api/nfc/scan.php
 *
 * Entry point for the ESP32 reader. Validates and stores the scanned UID, then
 * dispatches to the appropriate handler (visitor checkout, student check-in/out,
 * or unassigned-card response). The detailed flow lives in utils/scan-handlers.php;
 * this file is a thin orchestrator mirroring the original decision order.
 */

date_default_timezone_set('Asia/Manila');

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/device-auth.php';
require_once '../../utils/rate-limit.php';
require_once '../../utils/attendance-helpers.php';
require_once '../../utils/NotificationService.php';
require_once '../../utils/session-counter.php';
require_once '../../utils/auto-archiver.php';
require_once '../../utils/activity-logger.php';
require_once '../../utils/scan-handlers.php';

// Authenticate the device before doing any work. In production this requires
// the ESP32 to present the shared secret; in local dev (no secret set) it's a no-op.
requireDeviceAuth();

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

// Throttle per IP: a legitimate reader scans at most every ~3s, so 60/min is
// generous for real use while still blocking floods/replay abuse.
enforceRateLimit($conn, 'nfc_scan', 60, 60);

try {
    // (temp_nfc_scans table is provisioned by migration 009_runtime_tables.sql)
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
    $scannerMode = getScannerMode($conn);

    // --- VISITOR CHECK-OUT FLOW (terminates the request) ---
    if ($nfcTag && $nfcTag['visitor_session_id']) {
        handleVisitorCheckout($conn, $nfcTag, $uid, $scanInsertId);
    }

    if ($nfcTag && $nfcTag['student_id']) {
        // --- Student card in visitor mode: block it ---
        if ($scannerMode === 'visitor') {
            $payload = [
                'status'  => 'student_card',
                'uid'     => $uid,
                'message' => 'This card belongs to a student',
            ];
            storeScanResult($conn, $scanInsertId, $payload);
            sendSuccessResponse('Student card scanned in visitor mode', $payload);
        }

        // Shared student context for the handlers.
        $ctx = [
            'uid'           => $uid,
            'scanId'        => $scanInsertId,
            'studentId'     => $nfcTag['student_id'],
            'studentName'   => $nfcTag['student_name'],
            'studentCourse' => $nfcTag['course'],
            'guardianId'    => $nfcTag['guardian_id'],
            'today'         => date('Y-m-d'),
            'now'           => date('H:i:s'),
            'displayTime'   => date('h:i A'),
        ];

        // --- Archived student gate: deny all attendance for archived students ---
        if ($nfcTag['is_archived'] == 1) {
            $denialData = [
                'status'       => 'denied',
                'action'       => 'archived_denied',
                'uid'          => $uid,
                'student_id'   => $ctx['studentId'],
                'student_name' => $ctx['studentName'],
                'message'      => 'Student has completed all sessions',
                'timestamp'    => date('c'),
            ];
            storeScanResult($conn, $scanInsertId, $denialData);
            sendSuccessResponse('Attendance denied: student archived', $denialData);
        }

        // Schedule lookup (used by both check-in and check-out paths).
        $schedule = lookupSchedule($conn, $ctx['studentCourse']);

        // Is there an open attendance record today? (check-out vs check-in)
        $stmt = $conn->prepare("
            SELECT attendance_id, time_in
            FROM attendance_logs
            WHERE student_id = :student_id
              AND date = :date
              AND time_out IS NULL
            LIMIT 1
        ");
        $stmt->execute([':student_id' => $ctx['studentId'], ':date' => $ctx['today']]);
        $openRecord = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($openRecord) {
            $outcome = handleStudentCheckOut($conn, $ctx, $schedule, $openRecord);
        } else {
            $outcome = handleStudentCheckIn($conn, $ctx, $schedule);
        }

        $notifResult      = $outcome['notifResult'] ?? null;
        $remainingSessions = $outcome['remainingSessions'] ?? null;
        $notificationSent = $notifResult ? $notifResult['success'] : false;
        error_log("Attendance recorded: {$outcome['actionMessage']} | Notification sent: " . ($notificationSent ? 'yes' : 'no'));

        // action_result was already stored by the handler (before notifications)
        // so the kiosk frontend picks it up immediately. Just respond to ESP32.
        $responseData = [
            'status'            => 'assigned',
            'action'            => $outcome['action'],
            'uid'               => $uid,
            'student_id'        => $ctx['studentId'],
            'student_name'      => $ctx['studentName'],
            'notification_sent' => $notificationSent,
            'message'           => $outcome['actionMessage'],
        ];
        if (isset($remainingSessions)) {
            $responseData['remaining_sessions'] = $remainingSessions;
        }
        sendSuccessResponse('NFC tag scanned (assigned)', $responseData);
    } else {
        // Not assigned — respond according to scanner mode (terminates the request).
        handleUnassignedCard($conn, $scannerMode, $uid, $scanInsertId);
    }

} catch (PDOException $e) {
    error_log("NFC Scan Error: " . $e->getMessage());
    sendErrorResponse('Failed to store NFC scan', 500);
}
?>
