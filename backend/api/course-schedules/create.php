<?php
/**
 * Create Course Schedule API
 * POST /api/course-schedules/create.php
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

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendErrorResponse('Method not allowed', 405);
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

// Validate total_hours (optional, defaults to NULL)
$totalHours = null;
if (array_key_exists('total_hours', $input)) {
    $totalHoursValidation = validateTotalHours($input['total_hours']);
    if (!$totalHoursValidation['valid']) {
        $errors[] = $totalHoursValidation['error'];
    } else {
        $totalHours = $totalHoursValidation['value'];
    }
}

// end_time is optional when total_hours is provided (will be auto-computed)
$endTimeProvided = isset($input['end_time']) && !empty(trim($input['end_time']));
if (!$endTimeProvided && $totalHours === null) {
    $errors[] = 'end_time is required';
} elseif ($endTimeProvided && !preg_match('/^\d{2}:\d{2}(:\d{2})?$/', trim($input['end_time']))) {
    $errors[] = 'end_time must be a valid time format (HH:MM or HH:MM:SS)';
}

// Determine final end_time: auto-compute from total_hours if non-NULL (total_hours takes precedence)
$startTime = isset($input['start_time']) ? trim($input['start_time']) : null;
$endTime = null;

if (empty($errors) || (!str_contains(implode(' ', $errors), 'start_time') && !str_contains(implode(' ', $errors), 'end_time'))) {
    if ($totalHours !== null && $startTime !== null) {
        // Auto-compute end_time from total_hours (Req 7.1, 7.4: total_hours takes precedence)
        $endTime = computeEndTimeFromTotalHours($startTime, $totalHours);
    } elseif ($endTimeProvided) {
        $endTime = trim($input['end_time']);
    }

    // Validate end_time > start_time (only if both are valid)
    if ($startTime !== null && $endTime !== null) {
        if (strtotime($endTime) <= strtotime($startTime)) {
            $errors[] = 'end_time must be greater than start_time';
        }
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
    $stmt = $conn->prepare("
        INSERT INTO course_schedules (course_name, day_of_week, start_time, end_time, grace_period, total_hours)
        VALUES (:course_name, :day_of_week, :start_time, :end_time, :grace_period, :total_hours)
    ");

    $stmt->execute([
        ':course_name' => trim($input['course_name']),
        ':day_of_week' => trim($input['day_of_week']),
        ':start_time' => $startTime,
        ':end_time' => $endTime,
        ':grace_period' => $gracePeriod,
        ':total_hours' => $totalHours
    ]);

    $scheduleId = $conn->lastInsertId();

    $courseName = trim($input['course_name']);
    $dayOfWeek = trim($input['day_of_week']);
    logActivity('CREATE', 'COURSE_SCHEDULE', $courseName, "Schedule ID: {$scheduleId}, Day: {$dayOfWeek}, Time: {$startTime} - {$endTime}" . ($totalHours !== null ? ", Total Hours: {$totalHours}" : ''));

    // Build response data
    $responseData = [
        'schedule_id' => $scheduleId,
        'course_name' => $courseName,
        'day_of_week' => $dayOfWeek,
        'start_time' => $startTime,
        'end_time' => $endTime,
        'grace_period' => $gracePeriod,
        'total_hours' => $totalHours
    ];

    // Include warning if total_hours/4 > session window (Req 1.6)
    if ($totalHours !== null && $endTime !== null && $startTime !== null) {
        $sessionHours = $totalHours / 4;
        $windowSeconds = strtotime($endTime) - strtotime($startTime);
        $windowHours = $windowSeconds / 3600;
        if ($sessionHours > $windowHours) {
            $responseData['warning'] = 'The minimum session duration (total_hours/4 = ' . round($sessionHours, 2) . ' hours) exceeds the scheduled session window (' . round($windowHours, 2) . ' hours). Late students may not be able to render the full minimum session duration.';
        }
    }

    sendSuccessResponse('Course schedule created successfully', $responseData);

} catch (PDOException $e) {
    error_log("Create Course Schedule Error: " . $e->getMessage());
    sendErrorResponse('Failed to create course schedule', 500);
}
?>
