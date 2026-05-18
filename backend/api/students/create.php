<?php
/**
 * Create Student API
 * POST /api/students/create.php
 * 
 * Request Body:
 * {
 *   "guardian_id": 1,
 *   "student_name": "Jane Doe",
 *   "student_birthdate": "2010-05-15",
 *   "student_address": "123 Main St",
 *   "student_cellnum": "+639987654321",
 *   "student_course": "Mathematics",
 *   "course_duration": "6 months"
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

// Validate required fields
$missingFields = validateRequiredFields($input, ['guardian_id', 'student_name', 'student_address']);
if ($missingFields) {
    sendErrorResponse('Missing required fields: ' . implode(', ', $missingFields), 400);
}

$guardianId = intval($input['guardian_id']);
$studentName = trim($input['student_name']);
$studentAddress = trim($input['student_address']);
$studentBirthdate = isset($input['student_birthdate']) ? trim($input['student_birthdate']) : null;
$studentCellnum = isset($input['student_cellnum']) ? trim($input['student_cellnum']) : null;
$studentCourse = isset($input['student_course']) ? trim($input['student_course']) : null;
$courseDuration = isset($input['course_duration']) ? trim($input['course_duration']) : null;

// Calculate age from birthdate
$age = null;
if ($studentBirthdate) {
    $birthDate = new DateTime($studentBirthdate);
    $today = new DateTime();
    $age = $today->diff($birthDate)->y;
}

// Get database connection
$conn = getDBConnection();
if (!$conn) {
    sendErrorResponse('Database connection failed', 500);
}

try {
    // Verify guardian exists
    $stmt = $conn->prepare("SELECT guardian_id FROM guardians WHERE guardian_id = :id");
    $stmt->execute(['id' => $guardianId]);
    if (!$stmt->fetch()) {
        sendErrorResponse('Guardian not found', 404);
    }
    
    // Insert student with new fields
    $stmt = $conn->prepare("
        INSERT INTO students (
            guardian_id, 
            student_name, 
            student_birthdate, 
            age, 
            student_address, 
            student_cellnum, 
            student_course, 
            course_duration
        ) 
        VALUES (
            :guardian_id, 
            :name, 
            :birthdate, 
            :age, 
            :address, 
            :cellnum, 
            :course, 
            :duration
        )
    ");
    
    $stmt->execute([
        'guardian_id' => $guardianId,
        'name' => $studentName,
        'birthdate' => $studentBirthdate,
        'age' => $age,
        'address' => $studentAddress,
        'cellnum' => $studentCellnum,
        'course' => $studentCourse,
        'duration' => $courseDuration
    ]);
    
    $studentId = $conn->lastInsertId();
    
    // Log the activity
    logActivity(
        'CREATE',
        'STUDENT',
        $studentName,
        "Created student record (ID: $studentId, Course: " . ($studentCourse ?? 'N/A') . ")"
    );
    
    sendSuccessResponse('Student created successfully', [
        'student_id' => $studentId,
        'guardian_id' => $guardianId,
        'student_name' => $studentName,
        'student_birthdate' => $studentBirthdate,
        'age' => $age,
        'student_address' => $studentAddress,
        'student_cellnum' => $studentCellnum,
        'student_course' => $studentCourse,
        'course_duration' => $courseDuration
    ]);
    
} catch (PDOException $e) {
    error_log("Create Student Error: " . $e->getMessage());
    sendErrorResponse('Failed to create student', 500);
}
?>