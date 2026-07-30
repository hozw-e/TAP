<?php
/**
 * Visitor Check-out API
 * POST /api/visitors/checkout.php
 * Body: { "uid": "<NFC UID>" }
 * 
 * Finds the active visitor session linked to the given UID,
 * records time_out, releases the NFC tag back to unassigned status.
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

if (empty($input['uid'])) {
    sendErrorResponse('UID is required', 400);
}

$uid = strtoupper(trim($input['uid']));

$conn = getDBConnection();
if (!$conn) {
    sendErrorResponse('Database connection failed', 500);
}

try {
    // Find the NFC tag by UID
    $stmt = $conn->prepare("
        SELECT nfctag_id, visitor_session_id
        FROM nfc_tags
        WHERE uid = :uid
    ");
    $stmt->execute([':uid' => $uid]);
    $tag = $stmt->fetch(PDO::FETCH_ASSOC);

    // If tag not found or no active visitor session linked
    if (!$tag || empty($tag['visitor_session_id'])) {
        sendErrorResponse('No active visitor session found for this tag', 404);
    }

    $visitId  = $tag['visitor_session_id'];
    $nfctagId = $tag['nfctag_id'];

    // Get the visitor session details
    $stmt = $conn->prepare("
        SELECT visit_id, name
        FROM visitors
        WHERE visit_id = :visit_id
    ");
    $stmt->execute([':visit_id' => $visitId]);
    $visitor = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$visitor) {
        sendErrorResponse('Visitor session not found', 404);
    }

    $now = date('H:i:s');

    // Record time_out on the visitor session
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
    $stmt->execute([':nfctag_id' => $nfctagId]);

    logActivity('CHECK_OUT', 'VISITOR', $visitor['name'], "Visit ID: {$visitId}, Time out: {$now}", 'System');

    sendSuccessResponse('Visitor checked out successfully', [
        'visit_id' => (int)$visitor['visit_id'],
        'name'     => $visitor['name'],
        'time_out' => $now,
    ]);

} catch (PDOException $e) {
    error_log("Visitor Check-out Error: " . $e->getMessage());
    sendErrorResponse('Failed to check out visitor', 500);
}
?>
