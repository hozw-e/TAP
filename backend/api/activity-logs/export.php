<?php
require_once '../../config/database.php';
require_once '../../utils/session.php';

// Check if admin is logged in
if (!isAdminLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

try {
    $conn = getDBConnection();
    if (!$conn) {
        throw new Exception('Database connection failed');
    }

    // Get query parameters
    $fromDate = isset($_GET['from_date']) ? $_GET['from_date'] : date('Y-m-d');
    $toDate = isset($_GET['to_date']) ? $_GET['to_date'] : date('Y-m-d');
    $actionType = isset($_GET['action_type']) ? $_GET['action_type'] : '';
    $search = isset($_GET['search']) ? $_GET['search'] : '';

    // Build WHERE clause
    $whereConditions = [];
    $params = [];

    // Date range filter
    $whereConditions[] = "DATE(timestamp) >= ?";
    $params[] = $fromDate;
    
    $whereConditions[] = "DATE(timestamp) <= ?";
    $params[] = $toDate;

    // Action type filter
    if (!empty($actionType)) {
        $whereConditions[] = "action_type = ?";
        $params[] = $actionType;
    }

    // Search filter
    if (!empty($search)) {
        $whereConditions[] = "(admin_name LIKE ? OR entity_name LIKE ? OR details LIKE ?)";
        $searchTerm = "%{$search}%";
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
    }

    $whereClause = !empty($whereConditions) ? 'WHERE ' . implode(' AND ', $whereConditions) : '';

    // Get all logs matching filters
    $query = "SELECT * FROM activity_logs {$whereClause} ORDER BY timestamp DESC";
    $stmt = $conn->prepare($query);
    $stmt->execute($params);
    $logs = $stmt->fetchAll();

    // Generate CSV
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="activity_logs_' . date('Y-m-d_H-i-s') . '.csv"');

    $output = fopen('php://output', 'w');
    
    // Add BOM for UTF-8
    fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

    // Write header
    fputcsv($output, ['No.', 'Timestamp', 'Admin', 'Action', 'Entity Type', 'Entity Name', 'Details']);

    // Write data
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
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error exporting activity logs: ' . $e->getMessage()
    ]);
}
?>
