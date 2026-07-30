<?php
require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/session.php';
require_once '../../utils/activity-logger.php';
 
// Check if admin is logged in
requireAdminAuth();
 
// Get guardian ID from query parameter
$guardianId = isset($_GET['id']) ? intval($_GET['id']) : 0;
 
if ($guardianId <= 0) {
    sendErrorResponse('Invalid guardian ID');
}
 
// Get JSON input
$data = json_decode(file_get_contents('php://input'), true);
 
// Validate input
if (empty($data['guardian_name'])) {
    sendErrorResponse('Guardian name is required');
}

// Validate optional guardian_email field
$guardianEmail = isset($data['guardian_email']) && $data['guardian_email'] !== '' ? trim($data['guardian_email']) : null;

if ($guardianEmail !== null && !filter_var($guardianEmail, FILTER_VALIDATE_EMAIL)) {
    sendErrorResponse('Invalid email address format', 400);
}

// Legacy fields (kept for backward compatibility, no longer collected in forms)
// $messengerPsid = isset($data['messenger_psid']) ...
// $viberId = isset($data['viber_id']) ...

try {
    $conn = getDBConnection();
    
    if (!$conn) {
        sendErrorResponse('Database connection failed');
    }
    
    // Update guardian
    $stmt = $conn->prepare("
        UPDATE guardians 
        SET guardian_name = :guardian_name,
            guardian_address = :guardian_address,
            guardian_cellnum = :guardian_cellnum,
            guardian_email = :guardian_email
        WHERE guardian_id = :guardian_id
    ");
    
    $stmt->execute([
        ':guardian_name' => $data['guardian_name'],
        ':guardian_address' => $data['guardian_address'] ?? null,
        ':guardian_cellnum' => $data['guardian_cellnum'] ?? null,
        ':guardian_email' => $guardianEmail,
        ':guardian_id' => $guardianId
    ]);
    
    if ($stmt->rowCount() > 0 || $stmt->rowCount() === 0) {
        // rowCount() === 0 means no changes but record exists
        logActivity('UPDATE', 'GUARDIAN', $data['guardian_name'], "Guardian ID: {$guardianId}");

        sendSuccessResponse('Guardian updated successfully', [
            'guardian_id' => $guardianId
        ]);
    } else {
        sendErrorResponse('Guardian not found');
    }
    
} catch (PDOException $e) {
    error_log("Update guardian error: " . $e->getMessage());
    sendErrorResponse('Failed to update guardian');
}
?>
