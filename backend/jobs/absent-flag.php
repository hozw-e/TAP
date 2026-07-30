<?php
/**
 * Nightly absent-flag job
 * Run via cron at 23:59: php /path/to/backend/jobs/absent-flag.php
 *
 * Identifies non-archived students whose course has a schedule for today's
 * day-of-week and who have no attendance_logs row for today, then inserts
 * an attendance_logs record with attendance_flag = 'absent' and NULL time_in/time_out.
 */

date_default_timezone_set('Asia/Manila');
require_once __DIR__ . '/../config/database.php';

/**
 * Pure function: computes which students should be flagged absent.
 *
 * @param array $students Array of ['student_id' => int, 'course' => string]
 * @param array $scheduledCourses Array of course names that have schedules for today's day
 * @param array $existingLogStudentIds Array of student_ids that already have attendance records today
 * @return array Array of student_ids to flag as absent
 */
function computeAbsentees(array $students, array $scheduledCourses, array $existingLogStudentIds): array
{
    $absentees = [];

    // Index existing logs for O(1) lookup
    $loggedMap = array_flip($existingLogStudentIds);

    // Index scheduled courses for O(1) lookup
    $scheduledMap = array_flip($scheduledCourses);

    foreach ($students as $student) {
        $studentId = $student['student_id'];
        $course = $student['course'];

        // Student's course must have a schedule today
        if (!isset($scheduledMap[$course])) {
            continue;
        }

        // Student must not already have an attendance record today
        if (isset($loggedMap[$studentId])) {
            continue;
        }

        $absentees[] = $studentId;
    }

    return $absentees;
}

// ============================================================
// Main execution
// ============================================================

$conn = getDBConnection();
if (!$conn) {
    error_log('absent-flag.php: Failed to connect to database');
    echo "Absent flag job FAILED: database connection error\n";
    exit(1);
}

$today = date('Y-m-d');
$dayOfWeek = date('l'); // e.g. "Monday", "Tuesday", etc.

try {
    // 1. Get all non-archived students
    $stmtStudents = $conn->prepare("
        SELECT student_id, student_course AS course
        FROM students
        WHERE is_archived = 0 OR is_archived IS NULL
    ");
    $stmtStudents->execute();
    $students = $stmtStudents->fetchAll(PDO::FETCH_ASSOC);

    // 2. Get courses that have schedules for today's day of week
    $stmtSchedules = $conn->prepare("
        SELECT DISTINCT course_name
        FROM course_schedules
        WHERE day_of_week = :day_of_week
    ");
    $stmtSchedules->execute([':day_of_week' => $dayOfWeek]);
    $scheduledCourses = $stmtSchedules->fetchAll(PDO::FETCH_COLUMN);

    // 3. Get student_ids that already have attendance records for today
    $stmtLogs = $conn->prepare("
        SELECT DISTINCT student_id
        FROM attendance_logs
        WHERE date = :today AND student_id IS NOT NULL
    ");
    $stmtLogs->execute([':today' => $today]);
    $existingLogStudentIds = $stmtLogs->fetchAll(PDO::FETCH_COLUMN);

    // Cast to integers for consistency
    $existingLogStudentIds = array_map('intval', $existingLogStudentIds);

} catch (PDOException $e) {
    error_log('absent-flag.php: Failed to query data: ' . $e->getMessage());
    echo "Absent flag job FAILED: query error\n";
    exit(1);
}

// 4. Compute absentees using pure function
$absenteeIds = computeAbsentees($students, $scheduledCourses, $existingLogStudentIds);

// 5. Insert absent records
$flagged = 0;
$failures = 0;

$insertStmt = $conn->prepare("
    INSERT INTO attendance_logs (student_id, date, time_in, time_out, attendance_flag)
    VALUES (:student_id, :date, NULL, NULL, 'absent')
");

foreach ($absenteeIds as $studentId) {
    try {
        $insertStmt->execute([
            ':student_id' => $studentId,
            ':date' => $today,
        ]);
        $flagged++;
    } catch (PDOException $e) {
        error_log("absent-flag.php: Failed to flag student_id={$studentId} as absent: " . $e->getMessage());
        $failures++;
    }
}

echo "Absent flag job completed: {$flagged} students flagged absent, {$failures} failures\n";
