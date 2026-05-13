<?php
/**
 * Get Last NFC Scan
 * GET /api/nfc/get-last-scan.php
 *
 * Returns the most recent unconsumed scan from temp_nfc_scans.
 * Only returns scans that have been fully processed by scan.php (action_result populated).
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

    // Only return scans that scan.php has finished processing (action_result IS NOT NULL).
    // This eliminates the race condition where the frontend picks up a scan
    // before the ESP32's scan.php call has finished writing the result.
    $stmt = $conn->prepare("
        SELECT uid, scanned_at, action_result
        FROM temp_nfc_scans
        WHERE consumed = FALSE
          AND action_result IS NOT NULL
        ORDER BY scanned_at DESC
        LIMIT 1
    ");
    $stmt->execute();
    $scan = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$scan) {
        // No pending processed scan — return empty so frontend keeps polling
        sendSuccessResponse('No pending scan', ['uid' => null]);
        exit;
    }

    // Return the pre-processed result from scan.php directly
    $actionResult = json_decode($scan['action_result'], true);
    sendSuccessResponse('Scan found', array_merge(
        ['uid' => $scan['uid']],
        $actionResult
    ));

} catch (PDOException $e) {
    error_log("Get Last Scan Error: " . $e->getMessage());
    sendErrorResponse('Failed to get last scan: ' . $e->getMessage(), 500);
}
?>
