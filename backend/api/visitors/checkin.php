<?php
/**
 * Visitor Check-in API
 * POST /api/visitors/checkin.php
 * Body: { "name": "John Doe" }                     — manual flow
 * Body: { "name": "John Doe", "uid": "AB:CD:EF" }  — NFC flow
 */

date_default_timezone_set('Asia/Manila');

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/activity-logger.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendErrorResponse('Method not allowed', 405);
}

$input = json_decode(file_get_contents('php://input'), true);

if (empty($input['name'])) {
    sendErrorResponse('Name is required', 400);
}

$name  = trim($input['name']);
$uid   = isset($input['uid']) && trim($input['uid']) !== '' ? trim($input['uid']) : null;
$today = date('Y-m-d');
$now   = date('H:i:s');

$conn = getDBConnection();
if (!$conn) {
    sendErrorResponse('Database connection failed', 500);
}

try {
    // ─── NFC Flow (uid provided) ───────────────────────────────────────────────
    if ($uid !== null) {
        // 1. Validate the NFC tag exists and is unassigned
        $stmt = $conn->prepare("
            SELECT tag_id, student_id, visitor_session_id
            FROM nfc_tags
            WHERE uid = :uid
            LIMIT 1
        ");
        $stmt->execute([':uid' => $uid]);
        $tag = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$tag) {
            // Tag not in nfc_tags yet — auto-register it as an unassigned visitor card
            $stmt = $conn->prepare("
                INSERT INTO nfc_tags (uid, student_id, visitor_session_id)
                VALUES (:uid, NULL, NULL)
            ");
            $stmt->execute([':uid' => $uid]);
            $newTagId = $conn->lastInsertId();
            $tag = [
                'tag_id'             => $newTagId,
                'student_id'         => null,
                'visitor_session_id' => null,
            ];
        }

        if ($tag['student_id'] !== null) {
            sendErrorResponse('This tag is assigned to a student', 409);
        }

        if ($tag['visitor_session_id'] !== null) {
            sendErrorResponse('This tag is already linked to an active visitor session', 409);
        }

        // 2. Check if visitor already checked in today (same name + date)
        $stmt = $conn->prepare("
            SELECT visit_id FROM visitors
            WHERE name = :name AND date_of_visit = :date
            LIMIT 1
        ");
        $stmt->execute([':name' => $name, ':date' => $today]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($existing) {
            sendSuccessResponse('Already checked in today', [
                'created'  => false,
                'status'   => 'already_checked_in',
                'visit_id' => $existing['visit_id'],
                'name'     => $name,
            ]);
            exit;
        }

        // 3. Insert the visitor session
        $stmt = $conn->prepare("
            INSERT INTO visitors (name, date_of_visit, time_in)
            VALUES (:name, :date, :time_in)
        ");
        $stmt->execute([
            ':name'    => $name,
            ':date'    => $today,
            ':time_in' => $now,
        ]);
        $visitId = $conn->lastInsertId();

        // 4. Link the NFC tag to the new visitor session
        $stmt = $conn->prepare("
            UPDATE nfc_tags
            SET visitor_session_id = :visit_id
            WHERE uid = :uid
        ");
        $stmt->execute([
            ':visit_id' => $visitId,
            ':uid'      => $uid,
        ]);

        // 5. Log and return success
        logActivity('CHECK_IN', 'VISITOR', $name, "Visit ID: {$visitId}, NFC UID: {$uid}", 'System');

        sendSuccessResponse('Visitor checked in successfully', [
            'created'       => true,
            'status'        => 'checked_in',
            'visit_id'      => $visitId,
            'name'          => $name,
            'date_of_visit' => $today,
            'time_in'       => $now,
        ]);
        exit;
    }

    // ─── Manual Flow (no uid) ──────────────────────────────────────────────────

    // Check if visitor already checked in today
    $stmt = $conn->prepare("
        SELECT visit_id FROM visitors
        WHERE name = :name AND date_of_visit = :date
        LIMIT 1
    ");
    $stmt->execute([':name' => $name, ':date' => $today]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($existing) {
        sendSuccessResponse('Already checked in today', [
            'visit_id'      => $existing['visit_id'],
            'name'          => $name,
            'date_of_visit' => $today,
            'time_in'       => $now,
            'already_in'    => true,
        ]);
        exit;
    }

    $stmt = $conn->prepare("
        INSERT INTO visitors (name, date_of_visit, time_in)
        VALUES (:name, :date, :time_in)
    ");
    $stmt->execute([
        ':name'    => $name,
        ':date'    => $today,
        ':time_in' => $now,
    ]);

    $visitId = $conn->lastInsertId();
    logActivity('CHECK_IN', 'VISITOR', $name, "Visit ID: {$visitId}, Manual check-in", 'System');

    sendSuccessResponse('Visitor checked in successfully', [
        'visit_id'      => $visitId,
        'name'          => $name,
        'date_of_visit' => $today,
        'time_in'       => $now,
        'already_in'    => false,
    ]);

} catch (PDOException $e) {
    error_log("Visitor Check-in Error: " . $e->getMessage());
    sendErrorResponse('Failed to check in visitor', 500);
}
?>
