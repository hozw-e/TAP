<?php
/**
 * Get Last NFC Scan
 * GET /api/nfc/get-last-scan.php
 *
 * Returns the most recent unconsumed scan from temp_nfc_scans.
 * Polled by the frontend every 500ms while NFC scanning is active.
 */

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendErrorResponse('Method not allowed', 405);
}

try {
    $conn = getDBConnection();
    if (!$conn) {
        sendErrorResponse('Database connection failed', 500);
    }

    // Get the latest unconsumed scan
    $stmt = $conn->prepare("
        SELECT uid, scanned_at
        FROM temp_nfc_scans
        WHERE consumed = FALSE
        ORDER BY scanned_at DESC
        LIMIT 1
    ");
    $stmt->execute();
    $scan = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$scan) {
        // No pending scan — return empty so frontend keeps polling
        sendSuccessResponse('No pending scan', ['uid' => null]);
        exit;
    }

    // Check if this UID is already assigned to a student
    $stmt = $conn->prepare("
        SELECT n.nfctag_id, n.student_id, s.student_name
        FROM nfc_tags n
        LEFT JOIN students s ON n.student_id = s.student_id
        WHERE n.uid = :uid
    ");
    $stmt->execute([':uid' => $scan['uid']]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

    sendSuccessResponse('Scan found', [
        'uid'        => $scan['uid'],
        'unassigned' => !$existing || !$existing['student_id'],
        'student_id' => $existing['student_id'] ?? null,
        'student_name' => $existing['student_name'] ?? null,
    ]);

} catch (PDOException $e) {
    error_log("Get Last Scan Error: " . $e->getMessage());
    sendErrorResponse('Failed to get last scan: ' . $e->getMessage(), 500);
}
?>