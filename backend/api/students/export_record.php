<?php
/**
 * Export Student Attendance PDF (ViewRecord)
 * GET /api/students/export_record.php?student_id=...&date_from=...&date_to=...
 */

date_default_timezone_set('Asia/Manila');

require_once '../../config/database.php';
require_once '../../utils/session.php';
require_once '../../utils/activity-logger.php';
require_once '../../lib/fpdf.php';

$studentId = isset($_GET['student_id']) ? $_GET['student_id'] : null;
$dateFrom  = isset($_GET['date_from']) ? $_GET['date_from'] : date('Y-m-d');
$dateTo    = isset($_GET['date_to'])   ? $_GET['date_to']   : date('Y-m-d');

if (!$studentId || !preg_match('/^\d+$/', $studentId)) {
    http_response_code(400);
    exit('Invalid or missing student_id.');
}
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
    http_response_code(400);
    exit('Invalid date format.');
}

$conn = getDBConnection();
if (!$conn) { http_response_code(500); exit('Database connection failed.'); }

// Fetch student info
$stmt = $conn->prepare("SELECT student_name, student_course FROM students WHERE student_id = :student_id");
$stmt->execute([':student_id' => $studentId]);
$student = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$student) {
    http_response_code(404);
    exit('Student not found.');
}

// Fetch attendance logs
$stmt2 = $conn->prepare("
    SELECT date, time_in, time_out
    FROM attendance_logs
    WHERE student_id = :student_id AND date BETWEEN :date_from AND :date_to
    ORDER BY date ASC, time_in ASC
");
$stmt2->execute([
    ':student_id' => $studentId,
    ':date_from' => $dateFrom,
    ':date_to' => $dateTo
]);
$logs = $stmt2->fetchAll(PDO::FETCH_ASSOC);

function formatDisplayDate(string $date): string {
    return date('m/d/Y', strtotime($date));
}
function formatTimeDisplay(?string $time): string {
    if (!$time) return 'N/A';
    [$h, $m] = explode(':', $time);
    $h = (int)$h; $ampm = $h >= 12 ? 'PM' : 'AM';
    return sprintf('%d:%02d %s', $h % 12 ?: 12, $m, $ampm);
}

class StudentAttendancePDF extends FPDF {
    public string $studentName = '';
    public string $studentCourse = '';
    public string $dateFrom = '';
    public string $dateTo = '';

    function Header() {
        // Company header - centered
        $this->SetFont('Arial', 'B', 20);
        $this->SetTextColor(0, 112, 192);
        $this->Cell(0, 10, 'A+ Solution Development Center Corp.', 0, 1, 'C');
        $this->SetFont('Arial', 'B', 8.5);
        $this->SetTextColor(0, 0, 0);
        $this->Cell(0, 4.5, '35A National Highway, Lower Kalaklan, Olongapo City, Philippines 2200', 0, 1, 'C');
        $this->Cell(0, 4.5, '0917 832 6822 | (047) 232 2449 | infoapsteamph@gmail.com', 0, 1, 'C');
        $this->Ln(7);
        $this->SetFont('Arial', 'B', 14);
        $this->Cell(0, 8, 'Student Attendance Report', 0, 1, 'C');
        $this->SetFont('Arial', '', 12);
        $this->Cell(0, 7, $this->studentName, 0, 1, 'C');
        $this->Cell(0, 7, $this->studentCourse, 0, 1, 'C');
        $this->SetFont('Arial', 'B', 10);
        $this->Cell(0, 6, 'From ' . $this->dateFrom . '   To ' . $this->dateTo, 0, 1, 'C');
        $this->Ln(3);
        
        // Calculate table width and center position
        $tableWidth = 126; // 12 + 38 + 38 + 38
        $pageWidth = $this->GetPageWidth();
        $leftMargin = ($pageWidth - $tableWidth) / 2;
        $this->SetX($leftMargin);
        
        // Table header
        $this->SetFillColor(21, 61, 99);
        $this->SetTextColor(255, 255, 255);
        $this->SetFont('Arial', 'B', 9);
        $this->Cell(12, 8, '#', 1, 0, 'C', true);
        $this->Cell(38, 8, 'Date', 1, 0, 'C', true);
        $this->Cell(38, 8, 'Time In', 1, 0, 'C', true);
        $this->Cell(38, 8, 'Time Out', 1, 1, 'C', true);
        $this->SetTextColor(0, 0, 0);
    }
    function Footer() {
        $this->SetY(-12);
        $this->SetFont('Arial', 'I', 8);
        $this->SetTextColor(150, 150, 150);
        $this->Cell(0, 10, 'Page ' . $this->PageNo(), 0, 0, 'C');
    }
}

$pageOrientation = 'P';
$pageSize = 'A4';
$pdf = new StudentAttendancePDF($pageOrientation, 'mm', $pageSize);
$pdf->studentName = $student['student_name'];
$pdf->studentCourse = $student['student_course'];
$pdf->dateFrom = formatDisplayDate($dateFrom);
$pdf->dateTo = formatDisplayDate($dateTo);
$pdf->SetMargins(14, 14, 14);
$pdf->SetAutoPageBreak(true, 18);
$pdf->AddPage($pageOrientation, $pageSize);
$pdf->SetFont('Arial', '', 9);

if (empty($logs)) {
    $pdf->SetTextColor(150, 150, 150);
    $pdf->Cell(0, 12, 'No records found for the selected filters.', 0, 1, 'C');
} else {
    // Calculate table width and center position
    $tableWidth = 126; // 12 + 38 + 38 + 38
    $pageWidth = $pdf->GetPageWidth();
    $leftMargin = ($pageWidth - $tableWidth) / 2;
    
    foreach ($logs as $i => $row) {
        $pdf->SetX($leftMargin);
        $pdf->Cell(12, 8, $i+1, 1, 0, 'C');
        $pdf->Cell(38, 8, formatDisplayDate($row['date']), 1, 0, 'C');
        $pdf->Cell(38, 8, formatTimeDisplay($row['time_in']), 1, 0, 'C');
        $pdf->Cell(38, 8, formatTimeDisplay($row['time_out']), 1, 1, 'C');
    }
}

$filename = 'student_attendance_' . $studentId . '_' . $dateFrom . '_to_' . $dateTo . '.pdf';

// Log the export activity
logActivity(
    'EXPORT',
    'STUDENT',
    $student['student_name'],
    "Exported attendance record for student (ID: $studentId, $dateFrom to $dateTo)"
);

header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
$pdf->Output('D', $filename);
