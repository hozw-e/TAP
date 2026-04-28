<?php
/**
 * Export Attendance PDF
 * GET /api/dashboard/export.php?date_from=2026-04-01&date_to=2026-04-30
 */

date_default_timezone_set('Asia/Manila');

require_once '../../config/database.php';

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
    public string $logoPath = '';

    function Header() {
        // ── Logo (top-left, 224x224px source → ~22mm rendered) ──────────────
        if ($this->logoPath && file_exists($this->logoPath)) {
            $this->Image($this->logoPath, 14, 8, 22, 22);
        }

        // ── Company name (blue, bold, 20pt) ──────────────────────────────────
        $this->SetXY(38, 8);
        $this->SetFont('Arial', 'B', 20);
        $this->SetTextColor(0, 112, 192); // #0070C0
        $this->Cell(0, 10, 'A+ Solution Development Center Corp.', 0, 1, 'L');

        // ── Address (bold, 10pt, black) ───────────────────────────────────────
        $this->SetX(38);
        $this->SetFont('Arial', 'B', 10);
        $this->SetTextColor(0, 0, 0);
        $this->Cell(0, 6, '35A National Highway, Lower Kalaklan, Olongapo City, Philippines 2200', 0, 1, 'L');

        // ── Contact (bold, 10pt) ──────────────────────────────────────────────
        $this->SetX(38);
        $this->Cell(0, 6, '0917 832 6822 | (047) 232 2449 | infoapsteamph@gmail.com', 0, 1, 'L');

        $this->Ln(8);

        // ── "Attendance Report" title (bold, 16pt, centered) ─────────────────
        $this->SetFont('Arial', 'B', 16);
        $this->SetTextColor(0, 0, 0);
        $this->Cell(0, 8, 'Attendance Report', 0, 1, 'C');

        // ── Date range (bold, 11pt, centered) ────────────────────────────────
        $this->SetFont('Arial', 'B', 11);
        $this->Cell(0, 6, 'From ' . $this->dateFrom . '   To ' . $this->dateTo, 0, 1, 'C');

        $this->Ln(4);

        // ── Table header row — navy #153D63 ───────────────────────────────────
        // Column widths mirror the docx: 4531 / 1701 / 1418 / 1280 DXA
        // Total DXA = 8930 ≈ 181mm content width → scale to mm:
        //   Name:    4531/8930 * 181 ≈ 91.8 → 92mm
        //   Course:  1701/8930 * 181 ≈ 34.5 → 35mm
        //   Sessions:1418/8930 * 181 ≈ 28.7 → 29mm
        //   Hours:   1280/8930 * 181 ≈ 25.9 → 25mm  (total 181mm)
        $this->SetFillColor(21, 61, 99);   // #153D63
        $this->SetTextColor(255, 255, 255);
        $this->SetFont('Arial', '', 10);
        $this->Cell(92, 8, 'Name',        1, 0, 'C', true);
        $this->Cell(35, 8, 'Course',      1, 0, 'C', true);
        $this->Cell(29, 8, 'Sessions',    1, 0, 'C', true);
        $this->Cell(25, 8, 'Total Hours', 1, 1, 'C', true);

        $this->SetTextColor(0, 0, 0);
    }

    function Footer() {
        $this->SetY(-12);
        $this->SetFont('Arial', 'I', 8);
        $this->SetTextColor(150, 150, 150);
        $this->Cell(0, 10, 'Page ' . $this->PageNo(), 0, 0, 'C');
    }
}

// ── Resolve logo path ──────────────────────────────────────────────────────────
// export.php is at: backend/api/dashboard/export.php
// logo.png is at:   public/logo.png  (sibling of backend/)
$logoPath = dirname(__DIR__, 2) . '/public/logo.png';

$pdf = new AttendancePDF('P', 'mm', 'Letter');
$pdf->dateFrom = formatDisplayDate($dateFrom);
$pdf->dateTo   = formatDisplayDate($dateTo);
$pdf->logoPath = $logoPath;
$pdf->SetMargins(14, 14, 14);
$pdf->SetAutoPageBreak(true, 18);
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

        $bgR = $fill ? 235 : 255;
        $pdf->SetFillColor($bgR, $bgR, $bgR);
        $pdf->SetTextColor(0, 0, 0);
        $pdf->Cell(92, 8, $name,       1, 0, 'L', $fill);
        $pdf->Cell(35, 8, $course,     1, 0, 'C', $fill);
        $pdf->Cell(29, 8, $sessions,   1, 0, 'C', $fill);
        $pdf->Cell(25, 8, $totalHours, 1, 1, 'C', $fill);

        $fill = !$fill;
    }

    // Totals row
    $totalSessions = array_sum(array_column($rows, 'sessions'));
    $totalSecs     = (int)array_sum(array_column($rows, 'total_seconds'));

    $pdf->SetFont('Arial', 'B', 10);
    $pdf->SetFillColor(21, 61, 99);
    $pdf->SetTextColor(255, 255, 255);
    $pdf->Cell(92, 8, 'TOTAL',                    1, 0, 'L', true);
    $pdf->Cell(35, 8, '',                         1, 0, 'C', true);
    $pdf->Cell(29, 8, $totalSessions,             1, 0, 'C', true);
    $pdf->Cell(25, 8, secondsToHHMM($totalSecs),  1, 1, 'C', true);
}

$filename = 'attendance_' . $dateFrom . '_to_' . $dateTo . '.pdf';
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: no-cache');
$pdf->Output('D', $filename);
?>