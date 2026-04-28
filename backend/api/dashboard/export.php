<?php
/**
 * Export Attendance PDF
 * GET /api/dashboard/export.php?date_from=2026-04-01&date_to=2026-04-30
 */

date_default_timezone_set('Asia/Manila');

require_once '../../config/database.php';

// Get and validate date range
$dateFrom = isset($_GET['date_from']) ? $_GET['date_from'] : date('Y-m-d');
$dateTo   = isset($_GET['date_to'])   ? $_GET['date_to']   : date('Y-m-d');

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
    http_response_code(400);
    exit('Invalid date format.');
}

$conn = getDBConnection();
if (!$conn) {
    http_response_code(500);
    exit('Database connection failed.');
}

$stmt = $conn->prepare("
    SELECT
        s.student_name,
        s.student_course,
        COUNT(a.attendance_id) AS sessions,
        SUM(
            CASE
                WHEN a.time_out IS NOT NULL
                THEN TIME_TO_SEC(TIMEDIFF(a.time_out, a.time_in))
                ELSE 0
            END
        ) AS total_seconds
    FROM attendance_logs a
    JOIN students s ON a.student_id = s.student_id
    WHERE a.date BETWEEN :date_from AND :date_to
    GROUP BY s.student_id, s.student_name, s.student_course
    ORDER BY s.student_name ASC
");
$stmt->execute([':date_from' => $dateFrom, ':date_to' => $dateTo]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

function secondsToHHMM(int $seconds): string {
    $h = floor($seconds / 3600);
    $m = floor(($seconds % 3600) / 60);
    return sprintf('%02d:%02d', $h, $m);
}

function formatDisplayDate(string $date): string {
    return date('m/d/Y', strtotime($date));
}

require_once '../../lib/fpdf.php';

class AttendancePDF extends FPDF {
    public string $dateFrom = '';
    public string $dateTo   = '';

    function Header() {
        // Logo
        $logoPath = dirname(__DIR__, 3) . '/public/logo.png';
        if (file_exists($logoPath)) {
            $this->Image($logoPath, 15, 10, 22);
        }

        // Company name
        $this->SetXY(40, 10);
        $this->SetFont('Arial', 'B', 16);
        $this->SetTextColor(26, 82, 160);
        $this->Cell(0, 8, "A+ Solution Development Center Corp.", 0, 1, 'L');

        // Address
        $this->SetX(40);
        $this->SetFont('Arial', 'B', 9);
        $this->SetTextColor(0, 0, 0);
        $this->Cell(0, 5, '35A National Highway, Lower Kalaklan, Olongapo City, Philippines 2200', 0, 1, 'L');

        // Contact
        $this->SetX(40);
        $this->Cell(0, 5, '0917 832 6822 | (047) 232 2449 | infoapsteamph@gmail.com', 0, 1, 'L');

        $this->Ln(6);

        // Title
        $this->SetFont('Arial', 'B', 13);
        $this->Cell(0, 8, 'Attendance Report', 0, 1, 'C');

        // Date range
        $this->SetFont('Arial', 'B', 10);
        $this->Cell(0, 6, 'From ' . $this->dateFrom . '   To ' . $this->dateTo, 0, 1, 'C');

        $this->Ln(3);

        // Table header
        $this->SetFillColor(26, 82, 160);
        $this->SetTextColor(255, 255, 255);
        $this->SetFont('Arial', 'B', 10);
        $this->Cell(80, 9, 'Name',        1, 0, 'C', true);
        $this->Cell(55, 9, 'Course',      1, 0, 'C', true);
        $this->Cell(25, 9, 'Sessions',    1, 0, 'C', true);
        $this->Cell(30, 9, 'Total Hours', 1, 1, 'C', true);
        $this->SetTextColor(0, 0, 0);
    }

    function Footer() {
        $this->SetY(-12);
        $this->SetFont('Arial', 'I', 8);
        $this->SetTextColor(150, 150, 150);
        $this->Cell(0, 10, 'Page ' . $this->PageNo(), 0, 0, 'C');
    }
}

$pdf = new AttendancePDF('P', 'mm', 'A4');
$pdf->dateFrom = formatDisplayDate($dateFrom);
$pdf->dateTo   = formatDisplayDate($dateTo);
$pdf->SetMargins(15, 15, 15);
$pdf->SetAutoPageBreak(true, 20);
$pdf->AddPage();
$pdf->SetFont('Arial', '', 10);

if (empty($rows)) {
    $pdf->SetTextColor(150, 150, 150);
    $pdf->Cell(0, 12, 'No attendance records found for this date range.', 0, 1, 'C');
} else {
    $fill = false;
    foreach ($rows as $row) {
        $name       = $row['student_name']   ?? '---';
        $course     = $row['student_course'] ?? '---';
        $sessions   = (int)$row['sessions'];
        $totalHours = secondsToHHMM((int)$row['total_seconds']);

        $pdf->SetFillColor($fill ? 240 : 255, $fill ? 240 : 255, $fill ? 240 : 255);
        $pdf->Cell(80, 8, $name,       1, 0, 'L', $fill);
        $pdf->Cell(55, 8, $course,     1, 0, 'L', $fill);
        $pdf->Cell(25, 8, $sessions,   1, 0, 'C', $fill);
        $pdf->Cell(30, 8, $totalHours, 1, 1, 'C', $fill);

        $fill = !$fill;
    }

    // Totals row
    $totalSessions = array_sum(array_column($rows, 'sessions'));
    $totalSecs     = array_sum(array_column($rows, 'total_seconds'));

    $pdf->SetFont('Arial', 'B', 10);
    $pdf->SetFillColor(220, 230, 242);
    $pdf->Cell(80, 8, 'TOTAL',                        1, 0, 'L', true);
    $pdf->Cell(55, 8, '',                             1, 0, 'L', true);
    $pdf->Cell(25, 8, $totalSessions,                 1, 0, 'C', true);
    $pdf->Cell(30, 8, secondsToHHMM((int)$totalSecs), 1, 1, 'C', true);
}

$filename = 'attendance_' . $dateFrom . '_to_' . $dateTo . '.pdf';
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: no-cache');
$pdf->Output('D', $filename);
?>