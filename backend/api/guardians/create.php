<?php
/**
 * Create Guardian API
 * POST /api/guardians/create.php
 * 
 * Request Body:
 * {
 *   "guardian_name": "John Doe",
 *   "guardian_cellnum": "+639123456789"
 * }
 */

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/session.php';

// Check admin authentication
requireAdminAuth();

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendErrorResponse('Method not allowed', 405);
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Validate required fields
$missingFields = validateRequiredFields($input, ['guardian_name', 'guardian_cellnum']);
if ($missingFields) {
    sendErrorResponse('Missing required fields: ' . implode(', ', $missingFields), 400);
}

$guardianName = trim($input['guardian_name']);
$guardianCellnum = trim($input['guardian_cellnum']);

// Get database connection
$conn = getDBConnection();
if (!$conn) {
    sendErrorResponse('Database connection failed', 500);
}

try {
    // Insert guardian
    $stmt = $conn->prepare("
        INSERT INTO guardians (guardian_name, guardian_cellnum) 
        VALUES (:name, :cellnum)
    ");
    
    $stmt->execute([
        'name' => $guardianName,
        'cellnum' => $guardianCellnum
    ]);
    
    $guardianId = $conn->lastInsertId();
    
    sendSuccessResponse('Guardian created successfully', [
    'guardian_id' => $guardianId,
    'guardian_name' => $guardianName,
    'guardian_cellnum' => $guardianCellnum
    ]);
    
} catch (PDOException $e) {
    error_log("Create Guardian Error: " . $e->getMessage());
    sendErrorResponse('Failed to create guardian', 500);
}
?>
