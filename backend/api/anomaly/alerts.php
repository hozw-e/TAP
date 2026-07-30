<?php
/**
 * Anomaly Alerts API
 * GET /api/anomaly/alerts.php
 *
 * Query Parameters:
 * - student_id (required): Integer student ID
 * - pattern_type (optional): One of chronic_tardiness, attendance_dropoff, irregular_timing, early_departure
 * - date_start (optional): Start date filter (Y-m-d format)
 * - date_end (optional): End date filter (Y-m-d format)
 * - page (optional): Page number (default 1)
 *
 * Returns paginated JSON array of anomaly alerts sorted by detected_at DESC.
 */

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/session.php';

// Check admin authentication
requireAdminAuth();

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendErrorResponse('Method not allowed', 405);
}

// Validate required student_id parameter
if (!isset($_GET['student_id']) || $_GET['student_id'] === '') {
    sendErrorResponse('student_id parameter is required', 400);
}

$studentId = filter_var($_GET['student_id'], FILTER_VALIDATE_INT);
if ($studentId === false || $studentId <= 0) {
    sendErrorResponse('student_id must be a positive integer', 400);
}

// Validate optional pattern_type
$validPatternTypes = ['chronic_tardiness', 'attendance_dropoff', 'irregular_timing', 'early_departure'];
$patternType = null;
if (isset($_GET['pattern_type']) && $_GET['pattern_type'] !== '') {
    $patternType = $_GET['pattern_type'];
    if (!in_array($patternType, $validPatternTypes, true)) {
        sendErrorResponse('pattern_type must be one of: ' . implode(', ', $validPatternTypes), 400);
    }
}

// Validate optional date filters
$dateStart = null;
$dateEnd = null;

if (isset($_GET['date_start']) && $_GET['date_start'] !== '') {
    $ds = DateTime::createFromFormat('Y-m-d', $_GET['date_start']);
    if (!$ds || $ds->format('Y-m-d') !== $_GET['date_start']) {
        sendErrorResponse('date_start must be in Y-m-d format', 400);
    }
    $dateStart = $_GET['date_start'];
}

if (isset($_GET['date_end']) && $_GET['date_end'] !== '') {
    $de = DateTime::createFromFormat('Y-m-d', $_GET['date_end']);
    if (!$de || $de->format('Y-m-d') !== $_GET['date_end']) {
        sendErrorResponse('date_end must be in Y-m-d format', 400);
    }
    $dateEnd = $_GET['date_end'];
}

// Validate date range is within 365 days
if ($dateStart && $dateEnd) {
    $start = new DateTime($dateStart);
    $end = new DateTime($dateEnd);
    $diff = $start->diff($end);
    if ($diff->days > 365) {
        sendErrorResponse('Date range must not exceed 365 days', 400);
    }
    if ($start > $end) {
        sendErrorResponse('date_start must be before or equal to date_end', 400);
    }
}

// Validate page parameter
$page = 1;
if (isset($_GET['page']) && $_GET['page'] !== '') {
    $page = filter_var($_GET['page'], FILTER_VALIDATE_INT);
    if ($page === false || $page < 1) {
        sendErrorResponse('page must be a positive integer', 400);
    }
}

$perPage = 20;
$offset = ($page - 1) * $perPage;

// Get database connection
$conn = getDBConnection();
if (!$conn) {
    sendErrorResponse('Database connection failed', 500);
}

try {
    // Build WHERE conditions
    $conditions = ['student_id = :student_id'];
    $params = ['student_id' => $studentId];

    if ($patternType !== null) {
        $conditions[] = 'pattern_type = :pattern_type';
        $params['pattern_type'] = $patternType;
    }

    if ($dateStart !== null) {
        $conditions[] = 'detected_at >= :date_start';
        $params['date_start'] = $dateStart . ' 00:00:00';
    }

    if ($dateEnd !== null) {
        $conditions[] = 'detected_at <= :date_end';
        $params['date_end'] = $dateEnd . ' 23:59:59';
    }

    $whereClause = 'WHERE ' . implode(' AND ', $conditions);

    // Get total count for pagination
    $countQuery = "SELECT COUNT(*) as total FROM anomaly_alerts {$whereClause}";
    $countStmt = $conn->prepare($countQuery);
    $countStmt->execute($params);
    $total = (int) $countStmt->fetch()['total'];

    $totalPages = $total > 0 ? (int) ceil($total / $perPage) : 0;

    // Fetch paginated alerts
    $query = "
        SELECT 
            alert_id,
            student_id,
            pattern_type,
            score,
            description,
            detected_at
        FROM anomaly_alerts
        {$whereClause}
        ORDER BY detected_at DESC
        LIMIT :limit OFFSET :offset
    ";

    $stmt = $conn->prepare($query);
    foreach ($params as $key => $value) {
        $stmt->bindValue(':' . $key, $value);
    }
    $stmt->bindValue(':limit', $perPage, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();

    $alerts = $stmt->fetchAll();

    // Format score as float and detected_at as ISO 8601
    $formattedAlerts = array_map(function ($alert) {
        return [
            'alert_id' => (int) $alert['alert_id'],
            'student_id' => (int) $alert['student_id'],
            'pattern_type' => $alert['pattern_type'],
            'score' => (float) $alert['score'],
            'description' => $alert['description'],
            'detected_at' => str_replace(' ', 'T', $alert['detected_at']),
        ];
    }, $alerts);

    // Return response
    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'alerts' => $formattedAlerts,
        'pagination' => [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $total,
            'total_pages' => $totalPages,
        ],
    ]);
    exit();

} catch (PDOException $e) {
    error_log("Anomaly Alerts Error: " . $e->getMessage());
    sendErrorResponse('Failed to retrieve anomaly alerts', 500);
}
?>
