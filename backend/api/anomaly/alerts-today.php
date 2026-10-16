<?php
/**
 * Today's Anomaly Alerts (cohort-wide) API
 * GET /api/anomaly/alerts-today.php
 *
 * Returns every anomaly alert detected today, across all students, joined to
 * the student's name and course. This hydrates the dashboard's At-Risk panel
 * on page load so previously-detected alerts are visible immediately rather
 * than only appearing from live WebSocket broadcasts received after load.
 *
 * The payload shape intentionally matches the WebSocket `anomaly_alert` data
 * ({ student_id, student_name, pattern_type, score, description, detected_at })
 * so the frontend can feed these rows through the same sorting/dedup path as
 * the live broadcasts.
 *
 * Returns:
 *   200 { "success": true, "alerts": [ ...alert ] }
 */

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';
require_once '../../utils/session.php';

// Admin-only, read-only endpoint.
requireAdminAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendErrorResponse('Method not allowed', 405);
}

$conn = getDBConnection();
if (!$conn) {
    sendErrorResponse('Database connection failed', 500);
}

try {
    // Latest alert per (student, pattern) for today, highest score first.
    // Joining students lets us return the display name/course without a second
    // round trip and keeps archived students' stale alerts out of the panel.
    $query = "
        SELECT
            a.student_id,
            s.student_name,
            s.student_course,
            a.pattern_type,
            a.score,
            a.description,
            a.detected_at
        FROM anomaly_alerts a
        INNER JOIN students s ON s.student_id = a.student_id
        WHERE DATE(a.detected_at) = CURDATE()
          AND (s.is_archived = 0 OR s.is_archived IS NULL)
        ORDER BY a.score DESC, a.detected_at DESC
    ";

    $stmt = $conn->query($query);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $alerts = array_map(function ($row) {
        return [
            'student_id'   => (int) $row['student_id'],
            'student_name' => $row['student_name'],
            'course'       => $row['student_course'],
            'pattern_type' => $row['pattern_type'],
            'score'        => (float) $row['score'],
            'description'  => $row['description'],
            'detected_at'  => str_replace(' ', 'T', $row['detected_at']),
        ];
    }, $rows);

    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'alerts'  => $alerts,
    ]);
    exit();

} catch (PDOException $e) {
    error_log("Today's Anomaly Alerts Error: " . $e->getMessage());
    sendErrorResponse("Failed to retrieve today's anomaly alerts", 500);
}
?>
