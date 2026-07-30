<?php
/**
 * Create Guardian API
 * POST /api/guardians/create.php
 * 
 * Request Body:
 * {
 *   "guardian_name": "John Doe",
 *   "guardian_address": "123 Main St",
 *   "guardian_cellnum": "+639123456789",
 *   "guardian_email": "john@example.com"
 * }
 */

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/session.php';
require_once '../../utils/activity-logger.php';

// Check admin authentication
requireAdminAuth();

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendErrorResponse('Method not allowed', 405);
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Validate required fields (only guardian_name and guardian_cellnum are required)
$missingFields = validateRequiredFields($input, ['guardian_name', 'guardian_cellnum']);
if ($missingFields) {
    sendErrorResponse('Missing required fields: ' . implode(', ', $missingFields), 400);
}

$guardianName = trim($input['guardian_name']);
$guardianAddress = isset($input['guardian_address']) ? trim($input['guardian_address']) : null;
$guardianCellnum = trim($input['guardian_cellnum']);

// Validate optional guardian_email field
$guardianEmail = isset($input['guardian_email']) && $input['guardian_email'] !== '' ? trim($input['guardian_email']) : null;

if ($guardianEmail !== null && !filter_var($guardianEmail, FILTER_VALIDATE_EMAIL)) {
    sendErrorResponse('Invalid email address format', 400);
}

// Legacy fields (kept for backward compatibility, no longer collected in forms)
// $messengerPsid = isset($input['messenger_psid']) ...
// $viberId = isset($input['viber_id']) ...

// Get database connection
$conn = getDBConnection();
if (!$conn) {
    sendErrorResponse('Database connection failed', 500);
}

try {
    $stmt = $conn->prepare("
        INSERT INTO guardians (guardian_name, guardian_address, guardian_cellnum, guardian_email) 
        VALUES (:name, :address, :cellnum, :email)
    ");
    
    $stmt->execute([
        ':name' => $guardianName,
        ':address' => $guardianAddress,
        ':cellnum' => $guardianCellnum,
        ':email' => $guardianEmail
    ]);
    
    $guardianId = $conn->lastInsertId();

    logActivity('CREATE', 'GUARDIAN', $guardianName, "Guardian ID: {$guardianId}, Contact: {$guardianCellnum}");

    sendSuccessResponse('Guardian created successfully', [
        'guardian_id' => $guardianId,
        'guardian_name' => $guardianName,
        'guardian_address' => $guardianAddress,
        'guardian_cellnum' => $guardianCellnum,
        'guardian_email' => $guardianEmail
    ]);
    
} catch (PDOException $e) {
    error_log("Create Guardian Error: " . $e->getMessage());
    sendErrorResponse('Failed to create guardian', 500);
}
?>