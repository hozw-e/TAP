<?php
/**
 * Export Attendance PDF
 * GET /api/dashboard/export.php?date=2026-04-24
 *
 * Generates a PDF report with:
 * #, Name, Course, Number of Sessions, Total Hours (HH:MM)
 */

date_default_timezone_set('Asia/Manila');

require_once '../../config/database.php';

// Get and validate date
$date = isset($_GET['date']) ? $_GET['date'] : date('Y-m-d');
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    http_response_code(400);
    exit('Invalid date format.');
}

// Get database connection
$conn = getDBConnection();
if (!$conn) {
    http_response_code(500);
    exit('Database connection failed.');
}

// Fetch aggregated attendance data for the date
$stmt = $conn->prepare("
    SELECT
        s.student_name,
        s.student_course,
        COUNT(a.attendance_id)                          AS sessions,
        SUM(
            CASE
                WHEN a.time_out IS NOT NULL
                THEN TIME_TO_SEC(TIMEDIFF(a.time_out, a.time_in))
                ELSE 0
            END
        )                                               AS total_seconds
    FROM attendance_logs a
    JOIN students s ON a.student_id = s.student_id
    WHERE a.date = :date
    GROUP BY s.student_id, s.student_name, s.student_course
    ORDER BY s.student_name ASC
");
$stmt->execute([':date' => $date]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Format seconds → HH:MM
function secondsToHHMM(int $seconds): string {
    $h = floor($seconds / 3600);
    $m = floor(($seconds % 3600) / 60);
    return sprintf('%02d:%02d', $h, $m);
}

// Format date for display e.g. "April 24, 2026"
$displayDate = date('F j, Y', strtotime($date));

// -------------------------------------------------------
// Build PDF using FPDF (bundled inline — no install needed)
// Download fpdf.php from http://www.fpdf.org/ and place it
// at: backend/lib/fpdf.php
// -------------------------------------------------------
require_once '../../lib/fpdf.php';

class AttendancePDF extends FPDF {
    public string $reportDate = '';

    function Header() {
        // Title
        $this->SetFont('Arial', 'B', 16);
        $this->Cell(0, 10, "A+ Solutions Dev't Center", 0, 1, 'C');
        $this->SetFont('Arial', '', 11);
        $this->Cell(0, 7, 'Attendance Report — ' . $this->reportDate, 0, 1, 'C');
        $this->Ln(4);

        // Table header
        $this->SetFillColor(30, 50, 80);
        $this->SetTextColor(255, 255, 255);
        $this->SetFont('Arial', 'B', 10);
        $this->Cell(12,  9, '#',          1, 0, 'C', true);
        $this->Cell(65,  9, 'Name',       1, 0, 'C', true);
        $this->Cell(55,  9, 'Course',     1, 0, 'C', true);
        $this->Cell(30,  9, 'Sessions',   1, 0, 'C', true);
        $this->Cell(28,  9, 'Total Hours',1, 1, 'C', true);

        // Reset colors
        $this->SetTextColor(0, 0, 0);
        $this->SetFillColor(245, 245, 245);
    }

    function Footer() {
        $this->SetY(-15);
        $this->SetFont('Arial', 'I', 8);
        $this->SetTextColor(120, 120, 120);
        $this->Cell(0, 10, 'Generated on ' . date('F j, Y \a\t h:i A') . '   |   Page ' . $this->PageNo(), 0, 0, 'C');
    }
}

$pdf = new AttendancePDF('P', 'mm', 'A4');
$pdf->reportDate = $displayDate;
$pdf->SetMargins(15, 15, 15);
$pdf->SetAutoPageBreak(true, 20);
$pdf->AddPage();
$pdf->SetFont('Arial', '', 10);

if (empty($rows)) {
    $pdf->SetTextColor(150, 150, 150);
    $pdf->Cell(0, 12, 'No attendance records found for this date.', 0, 1, 'C');
} else {
    $fill = false;
    foreach ($rows as $i => $row) {
        $num        = $i + 1;
        $name       = $row['student_name']   ?? '---';
        $course     = $row['student_course'] ?? '---';
        $sessions   = (int)$row['sessions'];
        $totalHours = secondsToHHMM((int)$row['total_seconds']);

        $pdf->SetFillColor($fill ? 245 : 255, $fill ? 245 : 255, $fill ? 245 : 255);
        $pdf->Cell(12, 8, $num,        1, 0, 'C', $fill);
        $pdf->Cell(65, 8, $name,       1, 0, 'L', $fill);
        $pdf->Cell(55, 8, $course,     1, 0, 'L', $fill);
        $pdf->Cell(30, 8, $sessions,   1, 0, 'C', $fill);
        $pdf->Cell(28, 8, $totalHours, 1, 1, 'C', $fill);

        $fill = !$fill;
    }

    // Totals row
    $totalSessions = array_sum(array_column($rows, 'sessions'));
    $totalSecs     = array_sum(array_column($rows, 'total_seconds'));

    $pdf->SetFont('Arial', 'B', 10);
    $pdf->SetFillColor(220, 230, 242);
    $pdf->Cell(12,  8, '',                          1, 0, 'C', true);
    $pdf->Cell(65,  8, 'TOTAL',                     1, 0, 'L', true);
    $pdf->Cell(55,  8, '',                          1, 0, 'L', true);
    $pdf->Cell(30,  8, $totalSessions,              1, 0, 'C', true);
    $pdf->Cell(28,  8, secondsToHHMM((int)$totalSecs), 1, 1, 'C', true);
}

// Stream PDF to browser
$filename = 'attendance_' . $date . '.pdf';
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: no-cache');
$pdf->Output('D', $filename);
?>