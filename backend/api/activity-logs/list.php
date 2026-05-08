<?php
header('Content-Type: application/json');
require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/jwt.php';

// Check JWT authentication
$payload = requireJWTAuth();

try {
    $conn = getDBConnection();
    if (!$conn) {
        throw new Exception('Database connection failed');
    }

    // Get query parameters
    $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
    $limit = 10;
    $offset = ($page - 1) * $limit;
    
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

    // Search filter (search in admin_name, entity_name, or details)
    if (!empty($search)) {
        $whereConditions[] = "(admin_name LIKE ? OR entity_name LIKE ? OR details LIKE ?)";
        $searchTerm = "%{$search}%";
        $params[] = $searchTerm;
        $params[] = $searchTerm;
        $params[] = $searchTerm;
    }

    $whereClause = !empty($whereConditions) ? 'WHERE ' . implode(' AND ', $whereConditions) : '';

    // Get total count
    $countQuery = "SELECT COUNT(*) as total FROM activity_logs {$whereClause}";
    $countStmt = $conn->prepare($countQuery);
    $countStmt->execute($params);
    $totalCount = $countStmt->fetch()['total'];
    $totalPages = ceil($totalCount / $limit);

    // Get logs with pagination
    $query = "SELECT * FROM activity_logs {$whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?";
    $stmt = $conn->prepare($query);
    
    // Add pagination params
    $allParams = array_merge($params, [$limit, $offset]);
    $stmt->execute($allParams);
    $logs = $stmt->fetchAll();

    echo json_encode([
        'success' => true,
        'data' => $logs,
        'pagination' => [
            'current_page' => $page,
            'total_pages' => $totalPages,
            'total_count' => $totalCount,
            'per_page' => $limit
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error fetching activity logs: ' . $e->getMessage()
    ]);
}
?>
