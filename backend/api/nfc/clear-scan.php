<?php
/**
 * Clear NFC Scan
 * POST /api/nfc/clear-scan.php
 *
 * Marks all unconsumed scans as consumed after the frontend has read them.
 * Called by the frontend immediately after a UID is picked up by the poller.
 */

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/session.php';

// Check admin authentication
requireAdminAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendErrorResponse('Method not allowed', 405);
}

try {
    $conn = getDBConnection();
    if (!$conn) {
        sendErrorResponse('Database connection failed', 500);
    }

    $stmt = $conn->prepare("
        UPDATE temp_nfc_scans
        SET consumed = TRUE
        WHERE consumed = FALSE
    ");
    $stmt->execute();

    sendSuccessResponse('Scans cleared', ['cleared' => $stmt->rowCount()]);

} catch (PDOException $e) {
    error_log("Clear Scan Error: " . $e->getMessage());
    sendErrorResponse('Failed to clear scans', 500);
}
?>