<?php
/**
 * Update Student API
 * POST /api/students/update.php?id=1
 *
 * Request Body:
 * {
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

// Accept POST request (changed from PUT for better compatibility)
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendErrorResponse('Method not allowed', 405);
}

// Get student ID from query parameter
$studentId = isset($_GET['id']) ? intval($_GET['id']) : 0;

if ($studentId <= 0) {
    sendErrorResponse('Invalid student ID', 400);
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Validate required fields
$missingFields = validateRequiredFields($input, ['student_name', 'student_address']);
if ($missingFields) {
    sendErrorResponse('Missing required fields: ' . implode(', ', $missingFields), 400);
}

$studentName     = trim($input['student_name']);
$studentAddress  = trim($input['student_address']);
$studentBirthdate = isset($input['student_birthdate']) ? trim($input['student_birthdate']) : null;
$studentCellnum  = isset($input['student_cellnum'])  ? trim($input['student_cellnum'])  : null;
$studentCourse   = isset($input['student_course'])   ? trim($input['student_course'])   : null;
$courseDuration  = isset($input['course_duration'])  ? trim($input['course_duration'])  : null;

// Recalculate age from birthdate
$age = null;
if ($studentBirthdate) {
    $birthDate = new DateTime($studentBirthdate);
    $today     = new DateTime();
    $age       = $today->diff($birthDate)->y;
}

// Get database connection
$conn = getDBConnection();
if (!$conn) {
    sendErrorResponse('Database connection failed', 500);
}

try {
    // Verify student exists
    $stmt = $conn->prepare("SELECT student_id FROM students WHERE student_id = :id");
    $stmt->execute(['id' => $studentId]);
    if (!$stmt->fetch()) {
        sendErrorResponse('Student not found', 404);
    }

    // Update student
    $stmt = $conn->prepare("
        UPDATE students
        SET student_name     = :student_name,
            student_birthdate = :birthdate,
            age              = :age,
            student_address  = :address,
            student_cellnum  = :cellnum,
            student_course   = :course,
            course_duration  = :duration
        WHERE student_id = :student_id
    ");

    $stmt->execute([
        ':student_name' => $studentName,
        ':birthdate'    => $studentBirthdate,
        ':age'          => $age,
        ':address'      => $studentAddress,
        ':cellnum'      => $studentCellnum,
        ':course'       => $studentCourse,
        ':duration'     => $courseDuration,
        ':student_id'   => $studentId
    ]);

    // Log the activity
    logActivity(
        'UPDATE',
        'STUDENT',
        $studentName,
        'Student updated (ID: ' . $studentId . ')'
    );

    sendSuccessResponse('Student updated successfully', [
        'student_id'       => $studentId,
        'student_name'     => $studentName,
        'student_birthdate' => $studentBirthdate,
        'age'              => $age,
        'student_address'  => $studentAddress,
        'student_cellnum'  => $studentCellnum,
        'student_course'   => $studentCourse,
        'course_duration'  => $courseDuration
    ]);

} catch (PDOException $e) {
    error_log("Update Student Error: " . $e->getMessage());
    sendErrorResponse('Failed to update student', 500);
}
?>