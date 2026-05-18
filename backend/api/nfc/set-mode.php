<?php
/**
 * Set NFC Scanner Mode
 * POST /api/nfc/set-mode.php
 * 
 * Body: { "mode": "assign" } or { "mode": "attendance" }
 * 
 * Stores the current scanner mode so scan.php knows
 * whether an unassigned card is expected or an error.
 */

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendErrorResponse('Method not allowed', 405);
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['mode']) || !in_array($input['mode'], ['assign', 'attendance'])) {
    sendErrorResponse('mode must be "assign" or "attendance"', 400);
}

$mode = $input['mode'];

try {
    $conn = getDBConnection();
    if (!$conn) {
        sendErrorResponse('Database connection failed', 500);
    }

    // Create table if it doesn't exist
    $conn->exec("
        CREATE TABLE IF NOT EXISTS scanner_mode (
            id INT PRIMARY KEY DEFAULT 1,
            mode VARCHAR(20) NOT NULL DEFAULT 'attendance',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ");

    // Upsert the mode (always id=1, single row)
    $stmt = $conn->prepare("
        INSERT INTO scanner_mode (id, mode) VALUES (1, :mode)
        ON DUPLICATE KEY UPDATE mode = :mode2, updated_at = NOW()
    ");
    $stmt->execute([':mode' => $mode, ':mode2' => $mode]);

    sendSuccessResponse('Scanner mode updated', ['mode' => $mode]);

} catch (PDOException $e) {
    error_log("Set Mode Error: " . $e->getMessage());
    sendErrorResponse('Failed to set scanner mode', 500);
}
?>
