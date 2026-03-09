<?php
/**
 * Create Student API
 * POST /api/students/create.php
 * 
 * Request Body:
 * {
 *   "guardian_id": 1,
 *   "student_name": "Jane Doe",
 *   "address": "123 Main St",
 *   "student_cellnum": "+639987654321"
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
    sendError('Method not allowed', 405);
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Validate required fields
$missingFields = validateRequiredFields($input, ['guardian_id', 'student_name', 'address']);
if ($missingFields) {
    sendError('Missing required fields: ' . implode(', ', $missingFields), 400);
}

$guardianId = intval($input['guardian_id']);
$studentName = trim($input['student_name']);
$address = trim($input['address']);
$studentCellnum = isset($input['student_cellnum']) ? trim($input['student_cellnum']) : null;

// Get database connection
$conn = getDBConnection();
if (!$conn) {
    sendError('Database connection failed', 500);
}

try {
    // Verify guardian exists
    $stmt = $conn->prepare("SELECT guardian_id FROM guardians WHERE guardian_id = :id");
    $stmt->execute(['id' => $guardianId]);
    if (!$stmt->fetch()) {
        sendError('Guardian not found', 404);
    }
    
    // Insert student
    $stmt = $conn->prepare("
        INSERT INTO students (guardian_id, student_name, address, student_cellnum) 
        VALUES (:guardian_id, :name, :address, :cellnum)
    ");
    
    $stmt->execute([
        'guardian_id' => $guardianId,
        'name' => $studentName,
        'address' => $address,
        'cellnum' => $studentCellnum
    ]);
    
    $studentId = $conn->lastInsertId();
    
    sendSuccess([
        'student_id' => $studentId,
        'guardian_id' => $guardianId,
        'student_name' => $studentName,
        'address' => $address,
        'student_cellnum' => $studentCellnum
    ], 'Student created successfully', 201);
    
} catch (PDOException $e) {
    error_log("Create Student Error: " . $e->getMessage());
    sendError('Failed to create student', 500);
}
?>
