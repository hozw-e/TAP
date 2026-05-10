<?php
/**
 * Export Activity Logs PDF
 * GET /api/activity-logs/export.php?from_date=...&to_date=...&action_type=...
 */

date_default_timezone_set('Asia/Manila');

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/session.php';

if (!isAdminLoggedIn()) {
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$fromDate   = !empty($_GET['from_date'])  ? $_GET['from_date']  : date('Y-m-d');
$toDate     = !empty($_GET['to_date'])    ? $_GET['to_date']    : date('Y-m-d');
$actionType = isset($_GET['action_type']) ? trim($_GET['action_type']) : '';

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fromDate) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $toDate)) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Invalid date format']);
    exit;
}

try {
    $conn = getDBConnection();
    if (!$conn) { throw new Exception('Database connection failed'); }

    $whereConditions = [
        'DATE(timestamp) >= :from_date',
        'DATE(timestamp) <= :to_date',
    ];
    $params = [
        ':from_date' => $fromDate,
        ':to_date'   => $toDate,
    ];

    if ($actionType !== '') {
        $whereConditions[] = 'action_type = :action_type';
        $params[':action_type'] = $actionType;
    }

    $whereClause = 'WHERE ' . implode(' AND ', $whereConditions);

    $query = "SELECT * FROM activity_logs {$whereClause} ORDER BY timestamp DESC";
    $stmt  = $conn->prepare($query);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->execute();
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {
    error_log('Activity Logs Export Error: ' . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => 'Error fetching activity logs']);
    exit;
}

require_once '../../lib/fpdf.php';

function alDisplayDate(string $date): string {
    return date('m/d/Y', strtotime($date));
}

function alDisplayTimestamp(?string $ts): string {
    if (!$ts) return 'N/A';
    return date('m/d/Y h:i A', strtotime($ts));
}

class ActivityLogsPDF extends FPDF {
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
        $this->Cell(0, 8, 'Activity Logs Report', 0, 1, 'C');
        $this->SetFont('Arial', 'B', 10);
        $this->Cell(0, 6, 'From ' . $this->dateFrom . '   To ' . $this->dateTo, 0, 1, 'C');
        if ($this->filterInfo) {
            $this->SetFont('Arial', 'I', 9);
            $this->SetTextColor(100, 100, 100);
            $this->Cell(0, 5, $this->filterInfo, 0, 1, 'C');
            $this->SetTextColor(0, 0, 0);
        }
        $this->Ln(3);

        // Table header (landscape A4 usable width ~ 277mm)
        $this->SetFillColor(21, 61, 99);
        $this->SetTextColor(255, 255, 255);
        $this->SetFont('Arial', 'B', 9);
        $this->Cell(10, 8, '#',            1, 0, 'C', true);
        $this->Cell(36, 8, 'Timestamp',    1, 0, 'C', true);
        $this->Cell(40, 8, 'Admin',        1, 0, 'C', true);
        $this->Cell(28, 8, 'Action',       1, 0, 'C', true);
        $this->Cell(28, 8, 'Entity Type',  1, 0, 'C', true);
        $this->Cell(45, 8, 'Entity Name',  1, 0, 'C', true);
        $this->Cell(82, 8, 'Details',      1, 1, 'C', true);
        $this->SetTextColor(0, 0, 0);
    }

    function Footer() {
        $this->SetY(-12);
        $this->SetFont('Arial', 'I', 8);
        $this->SetTextColor(150, 150, 150);
        $this->Cell(0, 10, 'Page ' . $this->PageNo(), 0, 0, 'C');
    }
}

$filterInfo = $actionType !== '' ? 'Filter: Action = ' . $actionType : '';

$pdf = new ActivityLogsPDF('L', 'mm', 'A4');
$pdf->dateFrom   = alDisplayDate($fromDate);
$pdf->dateTo     = alDisplayDate($toDate);
$pdf->filterInfo = $filterInfo;
$pdf->SetMargins(10, 12, 10);
$pdf->SetAutoPageBreak(true, 18);
$pdf->AddPage();
$pdf->SetFont('Arial', '', 9);

if (empty($logs)) {
    $pdf->SetTextColor(150, 150, 150);
    $pdf->Cell(0, 12, 'No activity logs found for the selected filters.', 0, 1, 'C');
} else {
    $fill = false;
    foreach ($logs as $i => $row) {
        $bgR = $fill ? 235 : 255;
        $pdf->SetFillColor($bgR, $bgR, $bgR);

        // Truncate long details for single-line cells
        $details = $row['details'] ?? '';
        if (strlen($details) > 70) {
            $details = substr($details, 0, 67) . '...';
        }

        $pdf->Cell(10, 8, $i + 1,                               1, 0, 'C', $fill);
        $pdf->Cell(36, 8, alDisplayTimestamp($row['timestamp']),1, 0, 'C', $fill);
        $pdf->Cell(40, 8, $row['admin_name'] ?? '---',          1, 0, 'L', $fill);
        $pdf->Cell(28, 8, $row['action_type'] ?? '---',         1, 0, 'C', $fill);
        $pdf->Cell(28, 8, $row['entity_type'] ?? '---',         1, 0, 'C', $fill);
        $pdf->Cell(45, 8, $row['entity_name'] ?? '---',         1, 0, 'L', $fill);
        $pdf->Cell(82, 8, $details,                             1, 1, 'L', $fill);

        $fill = !$fill;
    }

    // Total row
    $pdf->SetFont('Arial', 'B', 9);
    $pdf->SetFillColor(21, 61, 99);
    $pdf->SetTextColor(255, 255, 255);
    $pdf->Cell(10, 8, '',              1, 0, 'C', true);
    $pdf->Cell(36, 8, 'TOTAL LOGS',    1, 0, 'L', true);
    $pdf->Cell(40, 8, count($logs),    1, 0, 'C', true);
    $pdf->Cell(28, 8, '',              1, 0, 'C', true);
    $pdf->Cell(28, 8, '',              1, 0, 'C', true);
    $pdf->Cell(45, 8, '',              1, 0, 'C', true);
    $pdf->Cell(82, 8, '',              1, 1, 'C', true);
}

$filename = 'activity_logs_' . $fromDate . '_to_' . $toDate . '.pdf';
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
$pdf->Output('D', $filename);
?>
