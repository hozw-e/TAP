<?php
/**
 * Export Attendance PDF
 * GET /api/dashboard/export.php?date_from=...&date_to=...&type=...&course=...
 */

date_default_timezone_set('Asia/Manila');

require_once '../../config/database.php';
require_once '../../utils/activity-logger.php';
require_once '../../utils/jwt.php';

// Check authentication (JWT or Session) - for PDF exports, check token from query param
$token = isset($_GET['token']) ? $_GET['token'] : null;
if ($token) {
    $_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $token;
}
requireAuth();

$dateFrom    = isset($_GET['date_from']) ? $_GET['date_from'] : date('Y-m-d');
$dateTo      = isset($_GET['date_to'])   ? $_GET['date_to']   : date('Y-m-d');
$filterType  = isset($_GET['type'])      ? $_GET['type']      : 'All';
$filterCourse = isset($_GET['course'])   ? $_GET['course']    : 'All';

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
    http_response_code(400);
    exit('Invalid date format.');
}

$conn = getDBConnection();
if (!$conn) { http_response_code(500); exit('Database connection failed.'); }

// Build student query
$studentWhere = "a.date BETWEEN :date_from AND :date_to";
$params = [':date_from' => $dateFrom, ':date_to' => $dateTo];

if ($filterCourse !== 'All') {
    $studentWhere .= " AND s.student_course = :course";
    $params[':course'] = $filterCourse;
}

$logs = [];

if ($filterType !== 'Visitor') {
    $stmt = $conn->prepare("
        SELECT
            s.student_name,
            s.student_course,
            a.date,
            a.time_in,
            a.time_out,
            'student' AS row_type
        FROM attendance_logs a
        LEFT JOIN students s ON a.student_id = s.student_id
        WHERE $studentWhere
        ORDER BY a.date ASC, a.time_in ASC
    ");
    $stmt->execute($params);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $logs[] = $row;
    }
}

if ($filterType !== 'Student' && $filterCourse === 'All') {
    $stmt2 = $conn->prepare("
        SELECT
            name AS student_name,
            NULL AS student_course,
            date_of_visit AS date,
            time_in,
            NULL AS time_out,
            'visitor' AS row_type
        FROM visitors
        WHERE date_of_visit BETWEEN :date_from AND :date_to
        ORDER BY date_of_visit ASC, time_in ASC
    ");
    $stmt2->execute([':date_from' => $dateFrom, ':date_to' => $dateTo]);
    foreach ($stmt2->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $logs[] = $row;
    }
}

// Sort by date then time
usort($logs, function($a, $b) {
    $d = strcmp($a['date'], $b['date']);
    return $d !== 0 ? $d : strcmp($a['time_in'], $b['time_in']);
});

function formatDisplayDate(string $date): string {
    return date('m/d/Y', strtotime($date));
}

function formatTimeDisplay(?string $time): string {
    if (!$time) return 'N/A';
    [$h, $m] = explode(':', $time);
    $h = (int)$h; $ampm = $h >= 12 ? 'PM' : 'AM';
    return sprintf('%d:%02d %s', $h % 12 ?: 12, $m, $ampm);
}

function calcDuration(?string $in, ?string $out): string {
    if (!$in || !$out) return 'N/A';
    $toSec = fn($t) => array_sum(array_map(fn($v,$m) => $v*$m, explode(':', $t), [3600,60,1]));
    $diff = $toSec($out) - $toSec($in);
    if ($diff < 0) return 'N/A';
    return sprintf('%d hrs %d mins', floor($diff/3600), floor(($diff%3600)/60));
}

require_once '../../lib/fpdf.php';

class AttendancePDF extends FPDF {
    public string $dateFrom  = '';
    public string $dateTo    = '';
    public string $logoPath  = '';
    public string $filterInfo = '';

    function Header() {
        // Company header block (logo + text) aligned on the upper-left
        if ($this->logoPath && file_exists($this->logoPath)) {
            $this->Image($this->logoPath, 14, 8, 28, 28);
        }
        $this->SetXY(48, 10);
        $this->SetFont('Arial', 'B', 20);
        $this->SetTextColor(0, 112, 192);
        $this->Cell(0, 10, 'A+ Solution Development Center Corp.', 0, 1, 'L');
        $this->SetX(48);
        $this->SetFont('Arial', 'B', 8.5);
        $this->SetTextColor(0, 0, 0);
        $this->Cell(0, 4.5, '35A National Highway, Lower Kalaklan, Olongapo City, Philippines 2200', 0, 1, 'L');
        $this->SetX(48);
        $this->Cell(0, 4.5, '0917 832 6822 | (047) 232 2449 | infoapsteamph@gmail.com', 0, 1, 'L');
        $this->Ln(7);

        $this->SetFont('Arial', 'B', 14);
        $this->Cell(0, 8, 'Attendance Report', 0, 1, 'C');
        $this->SetFont('Arial', 'B', 10);
        $this->Cell(0, 6, 'From ' . $this->dateFrom . '   To ' . $this->dateTo, 0, 1, 'C');
        if ($this->filterInfo) {
            $this->SetFont('Arial', 'I', 9);
            $this->SetTextColor(100, 100, 100);
            $this->Cell(0, 5, $this->filterInfo, 0, 1, 'C');
            $this->SetTextColor(0, 0, 0);
        }
        $this->Ln(3);
        // Table header
        $this->SetFillColor(21, 61, 99);
        $this->SetTextColor(255, 255, 255);
        $this->SetFont('Arial', 'B', 9);
        $this->Cell(8,  8, '#',       1, 0, 'C', true);
        $this->Cell(48, 8, 'Name',    1, 0, 'C', true); // was 55
        $this->Cell(25, 8, 'Course',  1, 0, 'C', true); // was 30
        $this->Cell(20, 8, 'Date',    1, 0, 'C', true); // was 22
        $this->Cell(20, 8, 'Time In', 1, 0, 'C', true); // was 22
        $this->Cell(22, 8, 'Time Out',1, 0, 'C', true); // was 23
        $this->Cell(17, 8, 'Duration',1, 1, 'C', true); // was 21
        $this->SetTextColor(0, 0, 0);
    }

    function Footer() {
        $this->SetY(-12);
        $this->SetFont('Arial', 'I', 8);
        $this->SetTextColor(150, 150, 150);
        $this->Cell(0, 10, 'Page ' . $this->PageNo(), 0, 0, 'C');
    }
}

$logoPath = dirname(__DIR__, 2) . '/public/logo.png';

// Build filter info string
$filterParts = [];
if ($filterType !== 'All') $filterParts[] = "Type: $filterType";
if ($filterCourse !== 'All') $filterParts[] = "Course: $filterCourse";
$filterInfo = !empty($filterParts) ? 'Filter: ' . implode(' | ', $filterParts) : '';

$pageOrientation = 'P';
$pageSize = 'A4';

$pdf = new AttendancePDF($pageOrientation, 'mm', $pageSize);
$pdf->dateFrom   = formatDisplayDate($dateFrom);
$pdf->dateTo     = formatDisplayDate($dateTo);
$pdf->logoPath   = $logoPath;
$pdf->filterInfo = $filterInfo;
$pdf->SetMargins(14, 14, 14);
$pdf->SetAutoPageBreak(true, 18);
$pdf->AddPage($pageOrientation, $pageSize);
$pdf->SetFont('Arial', '', 9);

if (empty($logs)) {
    $pdf->SetTextColor(150, 150, 150);
    $pdf->Cell(0, 12, 'No records found for the selected filters.', 0, 1, 'C');
} else {
    $fill = false;
    foreach ($logs as $i => $row) {
        $isVisitor = $row['row_type'] === 'visitor';
        $bgR = $fill ? 235 : 255;
        $pdf->SetFillColor($bgR, $bgR, $bgR);
        $pdf->Cell(8,  8, $i+1,                                        1, 0, 'C', $fill);
        $pdf->Cell(48, 8, $row['student_name'] ?? '---',               1, 0, 'L', $fill);
        $pdf->Cell(25, 8, $isVisitor ? 'Visitor' : ($row['student_course'] ?? '---'), 1, 0, 'C', $fill);
        $pdf->Cell(20, 8, formatDisplayDate($row['date']),             1, 0, 'C', $fill);
        $pdf->Cell(20, 8, formatTimeDisplay($row['time_in']),          1, 0, 'C', $fill);
        $pdf->Cell(22, 8, formatTimeDisplay($row['time_out']),         1, 0, 'C', $fill);
        $pdf->Cell(17, 8, calcDuration($row['time_in'], $row['time_out']), 1, 1, 'C', $fill);
        $fill = !$fill;
    }

    // Total row
    $pdf->SetFont('Arial', 'B', 9);
    $pdf->SetFillColor(21, 61, 99);
    $pdf->SetTextColor(255, 255, 255);
    $pdf->Cell(8,  8, '',                    1, 0, 'C', true);
    $pdf->Cell(48, 8, 'TOTAL RECORDS',       1, 0, 'L', true);
    $pdf->Cell(25, 8, count($logs),          1, 0, 'C', true);
    $pdf->Cell(20, 8, '',                    1, 0, 'C', true);
    $pdf->Cell(20, 8, '',                    1, 0, 'C', true);
    $pdf->Cell(22, 8, '',                    1, 0, 'C', true);
    $pdf->Cell(17, 8, '',                    1, 1, 'C', true);
}

// Log the export activity
logActivity(
    'EXPORT',
    'STUDENT',
    'Bulk Export',
    'Exported ' . count($logs) . ' attendance records from ' . $dateFrom . ' to ' . $dateTo . ' (Type: ' . $filterType . ', Course: ' . $filterCourse . ')'
);

$filename = 'attendance_a4_portrait_' . $dateFrom . '_to_' . $dateTo . '.pdf';
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
$pdf->Output('D', $filename);
?>