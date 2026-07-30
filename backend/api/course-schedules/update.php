<?php
/**
 * Update Course Schedule API
 * PUT /api/course-schedules/update.php?id=1
 * 
 * Request Body:
 * {
 *   "course_name": "Basic Coding",
 *   "day_of_week": "Monday",
 *   "start_time": "09:00",
 *   "end_time": "11:00",
 *   "grace_period": 15,
 *   "total_hours": 12.0
 * }
 */

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/session.php';
require_once '../../utils/activity-logger.php';
require_once '../../utils/attendance-helpers.php';

header('Content-Type: application/json');
requireAdminAuth();

// Only allow PUT requests
if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    sendErrorResponse('Method not allowed', 405);
}

// Get schedule ID from query parameter
$scheduleId = isset($_GET['id']) ? intval($_GET['id']) : 0;

if ($scheduleId <= 0) {
    sendErrorResponse('Invalid schedule ID', 400);
}

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

// Valid ENUM values
$validCourses = [
    'Basic Coding', 'Research', 'EV3', 'Rover 2', 'AI Steam',
    'Arduino', 'IoT', 'Python Programming', 'Robotics'
];
$validDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Validate required fields
$errors = [];

if (!isset($input['course_name']) || empty(trim($input['course_name']))) {
    $errors[] = 'course_name is required';
} elseif (!in_array($input['course_name'], $validCourses)) {
    $errors[] = 'course_name must be one of: ' . implode(', ', $validCourses);
}

if (!isset($input['day_of_week']) || empty(trim($input['day_of_week']))) {
    $errors[] = 'day_of_week is required';
} elseif (!in_array($input['day_of_week'], $validDays)) {
    $errors[] = 'day_of_week must be one of: ' . implode(', ', $validDays);
}

if (!isset($input['start_time']) || empty(trim($input['start_time']))) {
    $errors[] = 'start_time is required';
} elseif (!preg_match('/^\d{2}:\d{2}(:\d{2})?$/', trim($input['start_time']))) {
    $errors[] = 'start_time must be a valid time format (HH:MM or HH:MM:SS)';
}

// end_time is still accepted in the request but may be overridden by total_hours
if (isset($input['end_time']) && $input['end_time'] !== null && !empty(trim($input['end_time']))) {
    if (!preg_match('/^\d{2}:\d{2}(:\d{2})?$/', trim($input['end_time']))) {
        $errors[] = 'end_time must be a valid time format (HH:MM or HH:MM:SS)';
    }
}

// Validate total_hours (optional field — can be a number, null, or absent)
$totalHours = null;
$totalHoursProvided = array_key_exists('total_hours', $input);

if ($totalHoursProvided) {
    $validation = validateTotalHours($input['total_hours']);
    if (!$validation['valid']) {
        $errors[] = $validation['error'];
    } else {
        $totalHours = $validation['value'];
    }
}

// Validate grace_period (optional, defaults to 15)
$gracePeriod = 15;
if (isset($input['grace_period'])) {
    if (!is_numeric($input['grace_period']) || intval($input['grace_period']) != $input['grace_period']) {
        $errors[] = 'grace_period must be an integer';
    } else {
        $gracePeriod = intval($input['grace_period']);
        if ($gracePeriod < 0 || $gracePeriod > 120) {
            $errors[] = 'grace_period must be between 0 and 120';
        }
    }
}

if (!empty($errors)) {
    sendErrorResponse(implode('; ', $errors), 400);
}

// Get database connection
$conn = getDBConnection();
if (!$conn) {
    sendErrorResponse('Database connection failed', 500);
}

try {
    // Check if schedule exists and fetch current values
    $checkStmt = $conn->prepare("SELECT schedule_id, start_time, end_time, total_hours FROM course_schedules WHERE schedule_id = :id");
    $checkStmt->execute([':id' => $scheduleId]);
    $existingSchedule = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if (!$existingSchedule) {
        sendErrorResponse('Course schedule not found', 404);
    }

    // Determine the start_time to use (from input)
    $startTime = trim($input['start_time']);

    // Determine total_hours for end_time computation
    // If total_hours was provided in this request, use the new value
    // If total_hours was NOT provided, use the existing stored value
    $effectiveTotalHours = $totalHoursProvided ? $totalHours : ($existingSchedule['total_hours'] !== null ? (float) $existingSchedule['total_hours'] : null);

    // Determine end_time
    if ($totalHoursProvided && $totalHours !== null) {
        // total_hours is explicitly set to a non-NULL value: auto-compute end_time (Req 7.1, 7.4)
        $endTime = computeEndTimeFromTotalHours($startTime, $totalHours);
    } elseif ($totalHoursProvided && $totalHours === null) {
        // total_hours is explicitly set to NULL: do NOT modify existing end_time (Req 7.5)
        // Use end_time from input if provided, otherwise keep existing
        if (isset($input['end_time']) && $input['end_time'] !== null && !empty(trim($input['end_time']))) {
            $endTime = trim($input['end_time']);
        } else {
            $endTime = $existingSchedule['end_time'];
        }
    } elseif (!$totalHoursProvided && $existingSchedule['total_hours'] !== null) {
        // total_hours not in request but exists in DB: recompute end_time if start_time changed (Req 7.6)
        $endTime = computeEndTimeFromTotalHours($startTime, (float) $existingSchedule['total_hours']);
    } else {
        // No total_hours involvement: use end_time from request or existing
        if (isset($input['end_time']) && $input['end_time'] !== null && !empty(trim($input['end_time']))) {
            $endTime = trim($input['end_time']);
        } else {
            $endTime = $existingSchedule['end_time'];
        }
    }

    // Validate end_time > start_time (after potential auto-computation)
    if ($endTime !== null && strtotime($endTime) <= strtotime($startTime)) {
        sendErrorResponse('end_time must be greater than start_time', 400);
    }

    // Determine the total_hours value to store
    $storeTotalHours = $totalHoursProvided ? $totalHours : ($existingSchedule['total_hours'] !== null ? (float) $existingSchedule['total_hours'] : null);

    // Update the schedule
    $stmt = $conn->prepare("
        UPDATE course_schedules
        SET course_name = :course_name,
            day_of_week = :day_of_week,
            start_time = :start_time,
            end_time = :end_time,
            grace_period = :grace_period,
            total_hours = :total_hours
        WHERE schedule_id = :schedule_id
    ");

    $stmt->execute([
        ':course_name' => trim($input['course_name']),
        ':day_of_week' => trim($input['day_of_week']),
        ':start_time' => $startTime,
        ':end_time' => $endTime,
        ':grace_period' => $gracePeriod,
        ':total_hours' => $storeTotalHours,
        ':schedule_id' => $scheduleId
    ]);

    $courseName = trim($input['course_name']);
    $dayOfWeek = trim($input['day_of_week']);
    logActivity('UPDATE', 'COURSE_SCHEDULE', $courseName, "Schedule ID: {$scheduleId}, Day: {$dayOfWeek}, Time: {$startTime} - {$endTime}");

    sendSuccessResponse('Course schedule updated successfully', [
        'schedule_id' => $scheduleId,
        'course_name' => $courseName,
        'day_of_week' => $dayOfWeek,
        'start_time' => $startTime,
        'end_time' => $endTime,
        'grace_period' => $gracePeriod,
        'total_hours' => $storeTotalHours
    ]);

} catch (PDOException $e) {
    error_log("Update Course Schedule Error: " . $e->getMessage());
    sendErrorResponse('Failed to update course schedule', 500);
}
?>
