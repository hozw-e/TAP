<?php
/**
 * Visitor Records List API
 * GET /api/visitors/list.php
 * Params: page, from_date, to_date, search
 */

date_default_timezone_set('Asia/Manila');

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

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

try {
    $conn = getDBConnection();
    if (!$conn) {
        throw new Exception('Database connection failed');
    }

    // Pagination
    $page   = isset($_GET['page']) ? max(1, (int)$_GET['page']) : 1;
    $limit  = 10;
    $offset = ($page - 1) * $limit;

    // Filters
    $fromDate = !empty($_GET['from_date']) ? $_GET['from_date'] : '';
    $toDate   = !empty($_GET['to_date'])   ? $_GET['to_date']   : '';
    $search   = isset($_GET['search'])     ? trim($_GET['search']) : '';

    // Build WHERE clause
    $whereConditions = [];
    $params = [];

    if ($fromDate !== '') {
        $whereConditions[] = "date_of_visit >= :from_date";
        $params[':from_date'] = $fromDate;
    }

    if ($toDate !== '') {
        $whereConditions[] = "date_of_visit <= :to_date";
        $params[':to_date'] = $toDate;
    }

    if ($search !== '') {
        $whereConditions[] = "name LIKE :search";
        $params[':search'] = "%{$search}%";
    }

    $whereClause = count($whereConditions) > 0
        ? 'WHERE ' . implode(' AND ', $whereConditions)
        : '';

    // Total count
    $countQuery = "SELECT COUNT(*) AS total FROM visitors {$whereClause}";
    $countStmt  = $conn->prepare($countQuery);
    foreach ($params as $key => $value) {
        $countStmt->bindValue($key, $value);
    }
    $countStmt->execute();
    $totalRow   = $countStmt->fetch(PDO::FETCH_ASSOC);
    $totalCount = (int)($totalRow['total'] ?? 0);
    $totalPages = $totalCount > 0 ? (int)ceil($totalCount / $limit) : 1;

    // Paginated rows
    $query = "SELECT * FROM visitors {$whereClause} ORDER BY date_of_visit DESC, time_in DESC LIMIT :limit OFFSET :offset";
    $stmt  = $conn->prepare($query);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->bindValue(':limit',  $limit,  PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $visitors = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success'    => true,
        'data'       => $visitors,
        'pagination' => [
            'current_page' => $page,
            'total_pages'  => $totalPages,
            'total_count'  => $totalCount,
            'per_page'     => $limit
        ]
    ]);

} catch (Exception $e) {
    error_log('Visitor List Error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error fetching visitor records: ' . $e->getMessage()
    ]);
}
?>
