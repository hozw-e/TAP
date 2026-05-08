<?php
/**
 * List Guardians API
 * GET /api/guardians/list.php
 * 
 * Returns all guardians
 */

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/jwt.php';

// Check authentication (JWT or Session)
requireAuth();

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendErrorResponse('Method not allowed', 405);
}

// Get database connection
$conn = getDBConnection();
if (!$conn) {
    sendErrorResponse('Database connection failed', 500);
}

try {
    $stmt = $conn->query("SELECT * FROM guardians ORDER BY guardian_name ASC");
    $guardians = $stmt->fetchAll();
    
    sendSuccessResponse('Guardians retrieved successfully', $guardians);
    
} catch (PDOException $e) {
    error_log("List Guardians Error: " . $e->getMessage());
    sendErrorResponse('Failed to retrieve guardians', 500);
}
?>
