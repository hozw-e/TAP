<?php
/**
 * Reenroll Student API
 * POST /api/students/reenroll.php?id={student_id}
 *
 * Reenrolls an archived student into a (possibly new) course for a fresh
 * 4-session cycle. The SAME student_id is reused on purpose: attendance_logs
 * is keyed only by student_id (there is no per-record course column), so
 * reusing the id preserves the student's entire attendance history and keeps
 * it in scope for the anomaly detection service.
 *
 * This differs from unarchive.php, which only flips is_archived back to 0 and
 * leaves remaining_sessions at 0 for a completed student. Reenroll resets the
 * session counter so the student can actually attend again.
 *
 * Request Body:
 * {
 *   "student_course": "Robotics",     // required, must be a valid course
 *   "course_duration": "6 mos"        // optional
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

// Valid courses — must match the students.student_course ENUM in the schema
$VALID_COURSES = [
    'Basic Coding', 'Research', 'EV3', 'Rover 2',
    'AI Steam', 'Arduino', 'IoT', 'Python Programming', 'Robotics',
];

// Number of sessions granted per enrollment cycle
const REENROLL_SESSIONS = 4;

// Get student ID from query parameter
$studentId = isset($_GET['id']) ? intval($_GET['id']) : 0;

if ($studentId <= 0) {
    sendErrorResponse('Invalid student ID', 400);
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true) ?: [];

$studentCourse = isset($input['student_course']) ? trim($input['student_course']) : '';
$courseDuration = isset($input['course_duration']) ? trim($input['course_duration']) : null;

if ($studentCourse === '') {
    sendErrorResponse('A course is required to reenroll', 400);
}

if (!in_array($studentCourse, $VALID_COURSES, true)) {
    sendErrorResponse('Invalid course selected', 400);
}

try {
    $conn = getDBConnection();

    if (!$conn) {
        sendErrorResponse('Database connection failed', 500);
    }

    // Check the student exists and is archived
    $stmt = $conn->prepare(
        "SELECT student_id, student_name, is_archived FROM students WHERE student_id = :student_id"
    );
    $stmt->execute([':student_id' => $studentId]);
    $student = $stmt->fetch();

    if (!$student) {
        sendErrorResponse('Student not found', 404);
    }

    if ($student['is_archived'] == 0) {
        sendErrorResponse('Only archived students can be reenrolled', 400);
    }

    // Reenroll: reactivate, reset the session counter, and set the (new) course.
    // Reusing the same student_id preserves all prior attendance_logs history.
    $stmt = $conn->prepare("
        UPDATE students
        SET is_archived        = 0,
            remaining_sessions = :sessions,
            student_course     = :course,
            course_duration    = COALESCE(:duration, course_duration)
        WHERE student_id = :student_id
    ");
    $stmt->execute([
        ':sessions'   => REENROLL_SESSIONS,
        ':course'     => $studentCourse,
        ':duration'   => $courseDuration,
        ':student_id' => $studentId,
    ]);

    // Log the activity
    logActivity(
        'REENROLL',
        'STUDENT',
        $student['student_name'],
        "Student reenrolled: {$student['student_name']} (course: {$studentCourse}, sessions reset to " . REENROLL_SESSIONS . ")"
    );

    sendSuccessResponse('Student reenrolled successfully', [
        'student_id'         => $studentId,
        'student_name'       => $student['student_name'],
        'student_course'     => $studentCourse,
        'remaining_sessions' => REENROLL_SESSIONS,
    ]);

} catch (PDOException $e) {
    error_log("Reenroll student error: " . $e->getMessage());
    sendErrorResponse('Failed to reenroll student', 500);
}
?>
