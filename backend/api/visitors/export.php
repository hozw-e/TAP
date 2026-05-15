<?php
/**
 * Visitor Records Export (PDF)
 * GET /api/visitors/export.php
 * Params: from_date, to_date, search
 */

date_default_timezone_set('Asia/Manila');

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/session.php';
require_once '../../lib/fpdf.php';

// Check if admin is logged in
if (!isAdminLoggedIn()) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

try {
    $conn = getDBConnection();
    if (!$conn) {
        throw new Exception('Database connection failed');
    }

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

    // Fetch all matching records (no pagination for export)
    $query = "SELECT * FROM visitors {$whereClause} ORDER BY date_of_visit DESC, time_in DESC";
    $stmt  = $conn->prepare($query);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->execute();
    $visitors = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Generate PDF
    $pdf = new FPDF();
    $pdf->AddPage();
    $pdf->SetFont('Helvetica', 'B', 16);
    $pdf->Cell(0, 10, 'Visitor Records', 0, 1, 'C');
    $pdf->SetFont('Helvetica', '', 10);
    $pdf->Cell(0, 8, "From: {$fromDate}  To: {$toDate}", 0, 1, 'C');
    $pdf->Ln(5);

    // Table header
    $pdf->SetFont('Helvetica', 'B', 11);
    $pdf->SetFillColor(52, 73, 94);
    $pdf->SetTextColor(255, 255, 255);
    $pdf->Cell(15, 8, 'No.', 1, 0, 'C', true);
    $pdf->Cell(80, 8, 'Name', 1, 0, 'L', true);
    $pdf->Cell(45, 8, 'Date of Visit', 1, 0, 'C', true);
    $pdf->Cell(40, 8, 'Time In', 1, 1, 'C', true);

    // Table body
    $pdf->SetFont('Helvetica', '', 10);
    $pdf->SetTextColor(0, 0, 0);
    $rowNum = 1;
    foreach ($visitors as $visitor) {
        $pdf->Cell(15, 7, $rowNum, 1, 0, 'C');
        $pdf->Cell(80, 7, $visitor['name'], 1, 0, 'L');
        $pdf->Cell(45, 7, date('m/d/Y', strtotime($visitor['date_of_visit'])), 1, 0, 'C');
        $pdf->Cell(40, 7, date('h:i A', strtotime($visitor['time_in'])), 1, 1, 'C');
        $rowNum++;
    }

    if (empty($visitors)) {
        $pdf->SetFont('Helvetica', 'I', 10);
        $pdf->Cell(180, 10, 'No visitor records found for the selected date range.', 1, 1, 'C');
    }

    // Output PDF
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="visitor_records_' . $fromDate . '_to_' . $toDate . '.pdf"');
    $pdf->Output('D', 'visitor_records_' . $fromDate . '_to_' . $toDate . '.pdf');

} catch (Exception $e) {
    error_log('Visitor Export Error: ' . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Error exporting visitor records: ' . $e->getMessage()
    ]);
}
?>
