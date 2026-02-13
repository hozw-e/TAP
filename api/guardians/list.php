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
require_once '../../utils/session.php';

// Check admin authentication
requireAdminAuth();

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendError('Method not allowed', 405);
}

// Get database connection
$conn = getDBConnection();
if (!$conn) {
    sendError('Database connection failed', 500);
}

try {
    $stmt = $conn->query("SELECT * FROM guardians ORDER BY guardian_name ASC");
    $guardians = $stmt->fetchAll();
    
    sendSuccess($guardians, 'Guardians retrieved successfully');
    
} catch (PDOException $e) {
    error_log("List Guardians Error: " . $e->getMessage());
    sendError('Failed to retrieve guardians', 500);
}
?>
