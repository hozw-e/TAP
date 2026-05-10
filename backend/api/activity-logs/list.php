<?php
require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/session.php';

header('Content-Type: application/json');

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

    // Get query parameters (guard against empty strings sent by the frontend)
    $page = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
    $limit = 10;
    $offset = ($page - 1) * $limit;

    $fromDate   = !empty($_GET['from_date'])   ? $_GET['from_date']   : date('Y-m-d');
    $toDate     = !empty($_GET['to_date'])     ? $_GET['to_date']     : date('Y-m-d');
    $actionType = isset($_GET['action_type'])  ? trim($_GET['action_type']) : '';
    $search     = isset($_GET['search'])       ? trim($_GET['search'])      : '';

    // Build WHERE clause with named placeholders
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

    // Total count
    $countQuery = "SELECT COUNT(*) AS total FROM activity_logs {$whereClause}";
    $countStmt  = $conn->prepare($countQuery);
    foreach ($params as $key => $value) {
        $countStmt->bindValue($key, $value);
    }
    $countStmt->execute();
    $totalRow   = $countStmt->fetch(PDO::FETCH_ASSOC);
    $totalCount = (int)($totalRow['total'] ?? 0);
    $totalPages = $totalCount > 0 ? (int)ceil($totalCount / $limit) : 1;

    // Paginated rows
    // NOTE: LIMIT / OFFSET must be bound as integers. Passing them through
    // execute([...]) makes PDO quote them as strings under emulated prepares,
    // which MySQL rejects with a syntax error.
    $query = "SELECT * FROM activity_logs {$whereClause} ORDER BY timestamp DESC LIMIT :limit OFFSET :offset";
    $stmt  = $conn->prepare($query);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->bindValue(':limit',  $limit,  PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success'    => true,
        'data'       => $logs,
        'pagination' => [
            'current_page' => $page,
            'total_pages'  => $totalPages,
            'total_count'  => $totalCount,
            'per_page'     => $limit
        ]
    ]);

} catch (Exception $e) {
    error_log('Activity Logs List Error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error fetching activity logs: ' . $e->getMessage()
    ]);
}
?>
