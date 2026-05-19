<?php
/**
 * Visitor Records Export (PDF)
 * GET /api/visitors/export.php
 * Params: from_date, to_date, search
 */

// Start output buffering to prevent any stray whitespace from corrupting PDF output.
ob_start();

date_default_timezone_set('Asia/Manila');

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/session.php';
require_once '../../utils/activity-logger.php';
require_once '../../lib/fpdf.php';

// Check if admin is logged in
if (!isAdminLoggedIn()) {
    if (ob_get_level()) { ob_end_clean(); }
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    if (ob_get_level()) { ob_end_clean(); }
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
} catch (Exception $e) {
    error_log('Visitor Export Error: ' . $e->getMessage());
    if (ob_get_level()) { ob_end_clean(); }
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Error exporting visitor records'
    ]);
    exit;
}

function vrDisplayDate(string $date): string {
    return date('m/d/Y', strtotime($date));
}

function vrDisplayTime(?string $time): string {
    if (!$time) return 'N/A';
    return date('h:i A', strtotime($time));
}

class VisitorRecordsPDF extends FPDF {
    public string $dateFrom = '';
    public string $dateTo   = '';
    public string $filterInfo = '';

    function Header() {
        // Company header
        $this->SetFont('Arial', 'B', 20);
        $this->SetTextColor(0, 112, 192);
        $this->Cell(0, 10, 'A+ Solution Development Center Corp.', 0, 1, 'C');
        $this->SetFont('Arial', 'B', 8.5);
        $this->SetTextColor(0, 0, 0);
        $this->Cell(0, 4.5, '35A National Highway, Lower Kalaklan, Olongapo City, Philippines 2200', 0, 1, 'C');
        $this->Cell(0, 4.5, '0917 832 6822 | (047) 232 2449 | infoapsteamph@gmail.com', 0, 1, 'C');
        $this->Ln(7);

        $this->SetFont('Arial', 'B', 14);
        $this->Cell(0, 8, 'Visitor Records Report', 0, 1, 'C');
        $this->SetFont('Arial', 'B', 10);
        $this->Cell(0, 6, 'From ' . $this->dateFrom . '   To ' . $this->dateTo, 0, 1, 'C');
        if ($this->filterInfo) {
            $this->SetFont('Arial', 'I', 9);
            $this->SetTextColor(100, 100, 100);
            $this->Cell(0, 5, $this->filterInfo, 0, 1, 'C');
            $this->SetTextColor(0, 0, 0);
        }
        $this->Ln(3);

        // Calculate table width and center position
        $tableWidth = 168; // 12 + 70 + 44 + 42
        $pageWidth = $this->GetPageWidth();
        $leftMargin = ($pageWidth - $tableWidth) / 2;
        $this->SetX($leftMargin);

        // Table header
        $this->SetFillColor(21, 61, 99);
        $this->SetTextColor(255, 255, 255);
        $this->SetFont('Arial', 'B', 9);
        $this->Cell(12, 8, '#',             1, 0, 'C', true);
        $this->Cell(70, 8, 'Name',          1, 0, 'C', true);
        $this->Cell(44, 8, 'Date of Visit', 1, 0, 'C', true);
        $this->Cell(42, 8, 'Time In',       1, 1, 'C', true);
        $this->SetTextColor(0, 0, 0);
    }

    function Footer() {
        $this->SetY(-12);
        $this->SetFont('Arial', 'I', 8);
        $this->SetTextColor(150, 150, 150);
        $this->Cell(0, 10, 'Page ' . $this->PageNo(), 0, 0, 'C');
    }
}

$displayFrom = $fromDate !== '' ? vrDisplayDate($fromDate) : '---';
$displayTo   = $toDate !== ''   ? vrDisplayDate($toDate)   : '---';
$filterInfo  = $search !== '' ? 'Search: ' . $search : '';

$pdf = new VisitorRecordsPDF('P', 'mm', 'A4');
$pdf->dateFrom   = $displayFrom;
$pdf->dateTo     = $displayTo;
$pdf->filterInfo = $filterInfo;
$pdf->SetMargins(14, 14, 14);
$pdf->SetAutoPageBreak(true, 18);
$pdf->AddPage();
$pdf->SetFont('Arial', '', 9);

// Calculate table width and center position
$tableWidth = 168; // 12 + 70 + 44 + 42
$pageWidth = $pdf->GetPageWidth();
$leftMargin = ($pageWidth - $tableWidth) / 2;

if (empty($visitors)) {
    $pdf->SetTextColor(150, 150, 150);
    $pdf->Cell(0, 12, 'No visitor records found for the selected filters.', 0, 1, 'C');
} else {
    $fill = false;
    foreach ($visitors as $i => $visitor) {
        $bgR = $fill ? 235 : 255;
        $pdf->SetFillColor($bgR, $bgR, $bgR);
        $pdf->SetX($leftMargin);

        $pdf->Cell(12, 8, $i + 1, 1, 0, 'C', $fill);
        $pdf->Cell(70, 8, $visitor['name'], 1, 0, 'L', $fill);
        $pdf->Cell(44, 8, vrDisplayDate($visitor['date_of_visit']), 1, 0, 'C', $fill);
        $pdf->Cell(42, 8, vrDisplayTime($visitor['time_in']), 1, 1, 'C', $fill);

        $fill = !$fill;
    }

    // Total row
    $pdf->SetX($leftMargin);
    $pdf->SetFont('Arial', 'B', 9);
    $pdf->SetFillColor(21, 61, 99);
    $pdf->SetTextColor(255, 255, 255);
    $pdf->Cell(12, 8, '',                1, 0, 'C', true);
    $pdf->Cell(70, 8, 'TOTAL VISITORS',  1, 0, 'L', true);
    $pdf->Cell(44, 8, count($visitors),  1, 0, 'C', true);
    $pdf->Cell(42, 8, '',                1, 1, 'C', true);
}

$fromLabel = $fromDate !== '' ? $fromDate : 'all';
$toLabel = $toDate !== '' ? $toDate : 'latest';
$filename = 'visitor_records_' . $fromLabel . '_to_' . $toLabel . '.pdf';

// Log the export activity
logActivity(
    'EXPORT',
    'VISITOR',
    'Visitor Records Report',
    "Visitors exported ($fromDate to $toDate)"
);

// Clean any stray output from included files
if (ob_get_level()) {
    ob_end_clean();
}

header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
$pdf->Output('D', $filename);
