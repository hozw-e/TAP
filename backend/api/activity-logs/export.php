<?php
require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/session.php';

// Check if admin is logged in
if (!isAdminLoggedIn()) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

try {
    $conn = getDBConnection();
    if (!$conn) {
        throw new Exception('Database connection failed');
    }

    $fromDate   = !empty($_GET['from_date'])   ? $_GET['from_date']   : date('Y-m-d');
    $toDate     = !empty($_GET['to_date'])     ? $_GET['to_date']     : date('Y-m-d');
    $actionType = isset($_GET['action_type'])  ? trim($_GET['action_type']) : '';
    $search     = isset($_GET['search'])       ? trim($_GET['search'])      : '';

    $whereConditions = [];
    $params = [];

    $whereConditions[] = "DATE(timestamp) >= :from_date";
    $params[':from_date'] = $fromDate;

    $whereConditions[] = "DATE(timestamp) <= :to_date";
    $params[':to_date'] = $toDate;

    if ($actionType !== '') {
        $whereConditions[] = "action_type = :action_type";
        $params[':action_type'] = $actionType;
    }

    if ($search !== '') {
        $whereConditions[] = "(admin_name LIKE :search_admin OR entity_name LIKE :search_entity OR details LIKE :search_details)";
        $searchTerm = "%{$search}%";
        $params[':search_admin']   = $searchTerm;
        $params[':search_entity']  = $searchTerm;
        $params[':search_details'] = $searchTerm;
    }

    $whereClause = 'WHERE ' . implode(' AND ', $whereConditions);

    $query = "SELECT * FROM activity_logs {$whereClause} ORDER BY timestamp DESC";
    $stmt  = $conn->prepare($query);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->execute();
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // CSV output
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="activity_logs_' . date('Y-m-d_H-i-s') . '.csv"');

    $output = fopen('php://output', 'w');

    // UTF-8 BOM for Excel compatibility
    fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

    fputcsv($output, ['No.', 'Timestamp', 'Admin', 'Action', 'Entity Type', 'Entity Name', 'Details']);

    $counter = 1;
    foreach ($logs as $log) {
        fputcsv($output, [
            $counter++,
            $log['timestamp'],
            $log['admin_name'],
            $log['action_type'],
            $log['entity_type'],
            $log['entity_name'],
            $log['details']
        ]);
    }

    fclose($output);
    exit;

} catch (Exception $e) {
    error_log('Activity Logs Export Error: ' . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Error exporting activity logs: ' . $e->getMessage()
    ]);
}
?>
