<?php
/**
 * Dashboard - Absent/Expected Students Today
 * GET /api/dashboard/absent-today.php
 * 
 * Returns students who are expected today (their course is scheduled)
 * but have not checked in yet.
 */

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/session.php';

header('Content-Type: application/json');
requireAdminAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendErrorResponse('Method not allowed', 405);
}

$conn = getDBConnection();
if (!$conn) {
    sendErrorResponse('Database connection failed', 500);
}

try {
    date_default_timezone_set('Asia/Manila');
    $today = date('Y-m-d');
    $dayOfWeek = date('l'); // e.g. "Monday"

    // Get courses scheduled for today
    $stmtSchedules = $conn->prepare("
        SELECT DISTINCT course_name
        FROM course_schedules
        WHERE day_of_week = :day_of_week
    ");
    $stmtSchedules->execute([':day_of_week' => $dayOfWeek]);
    $scheduledCourses = $stmtSchedules->fetchAll(PDO::FETCH_COLUMN);

    if (empty($scheduledCourses)) {
        sendSuccessResponse('No courses scheduled today', [
            'absent_students' => [],
            'total_expected' => 0,
            'total_absent' => 0
        ]);
        exit;
    }

    // Get non-archived students enrolled in today's scheduled courses
    $placeholders = [];
    $params = [];
    foreach ($scheduledCourses as $i => $course) {
        $placeholders[] = ":course_$i";
        $params["course_$i"] = $course;
    }
    $courseList = implode(', ', $placeholders);

    $stmtStudents = $conn->prepare("
        SELECT student_id, student_name, student_course
        FROM students
        WHERE (is_archived = 0 OR is_archived IS NULL)
        AND student_course IN ($courseList)
        ORDER BY student_name ASC
    ");
    $stmtStudents->execute($params);
    $expectedStudents = $stmtStudents->fetchAll(PDO::FETCH_ASSOC);

    $totalExpected = count($expectedStudents);

    // Get student_ids who already checked in today
    $stmtLogs = $conn->prepare("
        SELECT DISTINCT student_id
        FROM attendance_logs
        WHERE date = :today AND student_id IS NOT NULL AND time_in IS NOT NULL
    ");
    $stmtLogs->execute([':today' => $today]);
    $presentIds = array_map('intval', $stmtLogs->fetchAll(PDO::FETCH_COLUMN));
    $presentMap = array_flip($presentIds);

    // Filter to only absent students
    $absentStudents = [];
    foreach ($expectedStudents as $student) {
        if (!isset($presentMap[(int)$student['student_id']])) {
            $absentStudents[] = $student;
        }
    }

    sendSuccessResponse('Absent students retrieved', [
        'absent_students' => $absentStudents,
        'total_expected' => $totalExpected,
        'total_absent' => count($absentStudents)
    ]);

} catch (PDOException $e) {
    error_log("Dashboard Absent Today Error: " . $e->getMessage());
    sendErrorResponse('Failed to retrieve absent students', 500);
}
?>
