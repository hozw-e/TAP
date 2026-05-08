<?php
/**
 * Visitor Check-in API
 * POST /api/visitors/checkin.php
 * Body: { "name": "John Doe" }
 */

date_default_timezone_set('Asia/Manila');

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendErrorResponse('Method not allowed', 405);
}

$input = json_decode(file_get_contents('php://input'), true);

if (empty($input['name'])) {
    sendErrorResponse('Name is required', 400);
}

$name  = trim($input['name']);
$today = date('Y-m-d');
$now   = date('H:i:s');

$conn = getDBConnection();
if (!$conn) {
    sendErrorResponse('Database connection failed', 500);
}

try {
    // Check if visitor already checked in today
    $stmt = $conn->prepare("
        SELECT visit_id FROM visitors
        WHERE name = :name AND date_of_visit = :date
        LIMIT 1
    ");
    $stmt->execute([':name' => $name, ':date' => $today]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($existing) {
        sendSuccessResponse('Already checked in today', [
            'visit_id'      => $existing['visit_id'],
            'name'          => $name,
            'date_of_visit' => $today,
            'time_in'       => $now,
            'already_in'    => true,
        ]);
        exit;
    }

    $stmt = $conn->prepare("
        INSERT INTO visitors (name, date_of_visit, time_in)
        VALUES (:name, :date, :time_in)
    ");
    $stmt->execute([
        ':name'    => $name,
        ':date'    => $today,
        ':time_in' => $now,
    ]);

    sendSuccessResponse('Visitor checked in successfully', [
        'visit_id'      => $conn->lastInsertId(),
        'name'          => $name,
        'date_of_visit' => $today,
        'time_in'       => $now,
        'already_in'    => false,
    ]);

} catch (PDOException $e) {
    error_log("Visitor Check-in Error: " . $e->getMessage());
    sendErrorResponse('Failed to check in visitor', 500);
}
?>