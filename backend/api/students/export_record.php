<?php
/**
 * Export Student Attendance PDF (ViewRecord)
 * GET /api/students/export_record.php?student_id=...&date_from=...&date_to=...&status=All
 */

date_default_timezone_set('Asia/Manila');

require_once '../../utils/cors.php';
require_once '../../config/database.php';
require_once '../../utils/session.php';
require_once '../../utils/activity-logger.php';
require_once '../../lib/fpdf.php';

$studentId = isset($_GET['student_id']) ? $_GET['student_id'] : null;
$dateFrom  = isset($_GET['date_from']) ? $_GET['date_from'] : date('Y-m-d');
$dateTo    = isset($_GET['date_to'])   ? $_GET['date_to']   : date('Y-m-d');
$statusFilter = isset($_GET['status']) ? $_GET['status'] : 'All';

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

// Fetch student info including created_at for enrollment date
$stmt = $conn->prepare("SELECT student_name, student_course, created_at FROM students WHERE student_id = :student_id");
$stmt->execute([':student_id' => $studentId]);
$student = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$student) {
    http_response_code(404);
    exit('Student not found.');
}

// Fetch attendance logs in the date range
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

// Build a map of dates that have actual attendance logs
$logsByDate = [];
foreach ($logs as $log) {
    $logsByDate[$log['date']][] = $log;
}

// Determine enrollment date
$enrollmentDate = $student['created_at'] ? date('Y-m-d', strtotime($student['created_at'])) : null;

// Generate all dates in range (Mon-Sat only), starting from enrollment if applicable
$allRecords = [];
$currentDate = new DateTime($dateFrom);
$endDate = new DateTime($dateTo);

while ($currentDate <= $endDate) {
    $dateStr = $currentDate->format('Y-m-d');
    $dayOfWeek = (int)$currentDate->format('w'); // 0=Sun, 6=Sat

    // Only include Mon-Sat and dates on or after enrollment
    if ($dayOfWeek !== 0 && (!$enrollmentDate || $dateStr >= $enrollmentDate)) {
        if (isset($logsByDate[$dateStr])) {
            // Has actual attendance records for this date
            foreach ($logsByDate[$dateStr] as $log) {
                $status = 'Absent';
                if ($log['time_in'] && $log['time_out']) {
                    $status = 'Present';
                } elseif ($log['time_in'] && !$log['time_out']) {
                    $status = 'No Time Out';
                }
                $allRecords[] = [
                    'date' => $log['date'],
                    'time_in' => $log['time_in'],
                    'time_out' => $log['time_out'],
                    'status' => $status,
                ];
            }
        } else {
            // No attendance log for this date = Absent
            $allRecords[] = [
                'date' => $dateStr,
                'time_in' => null,
                'time_out' => null,
                'status' => 'Absent',
            ];
        }
    }

    $currentDate->modify('+1 day');
}

// Apply status filter
if ($statusFilter !== 'All') {
    $allRecords = array_filter($allRecords, function($record) use ($statusFilter) {
        return $record['status'] === $statusFilter;
    });
    $allRecords = array_values($allRecords);
}

function formatDisplayDate(string $date): string {
    return date('m/d/Y', strtotime($date));
}
function formatTimeDisplay(?string $time): string {
    if (!$time) return '--';
    $parts = explode(':', $time);
    $h = (int)$parts[0];
    $m = $parts[1];
    $ampm = $h >= 12 ? 'PM' : 'AM';
    return sprintf('%d:%s %s', $h % 12 ?: 12, $m, $ampm);
}

class StudentAttendancePDF extends FPDF {
    public string $studentName = '';
    public string $studentCourse = '';
    public string $dateFrom = '';
    public string $dateTo = '';
    public string $statusFilter = 'All';

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
        $filterLabel = 'From ' . $this->dateFrom . '   To ' . $this->dateTo;
        if ($this->statusFilter !== 'All') {
            $filterLabel .= '   Status: ' . $this->statusFilter;
        }
        $this->Cell(0, 6, $filterLabel, 0, 1, 'C');
        $this->Ln(3);
        
        // Calculate table width and center position
        $tableWidth = 164; // 12 + 38 + 38 + 38 + 38
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
        $this->Cell(38, 8, 'Time Out', 1, 0, 'C', true);
        $this->Cell(38, 8, 'Status', 1, 1, 'C', true);
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
$pdf->statusFilter = $statusFilter;
$pdf->SetMargins(14, 14, 14);
$pdf->SetAutoPageBreak(true, 18);
$pdf->AddPage($pageOrientation, $pageSize);
$pdf->SetFont('Arial', '', 9);

if (empty($allRecords)) {
    $pdf->SetTextColor(150, 150, 150);
    $pdf->Cell(0, 12, 'No records found for the selected filters.', 0, 1, 'C');
} else {
    // Calculate table width and center position
    $tableWidth = 164; // 12 + 38 + 38 + 38 + 38
    $pageWidth = $pdf->GetPageWidth();
    $leftMargin = ($pageWidth - $tableWidth) / 2;
    
    foreach ($allRecords as $i => $row) {
        $pdf->SetX($leftMargin);
        $pdf->Cell(12, 8, $i + 1, 1, 0, 'C');
        $pdf->Cell(38, 8, formatDisplayDate($row['date']), 1, 0, 'C');
        $pdf->Cell(38, 8, formatTimeDisplay($row['time_in']), 1, 0, 'C');
        $pdf->Cell(38, 8, formatTimeDisplay($row['time_out']), 1, 0, 'C');
        
        // Status cell with color
        $status = $row['status'];
        if ($status === 'Present') {
            $pdf->SetFillColor(76, 175, 80);
            $pdf->SetTextColor(255, 255, 255);
        } elseif ($status === 'Absent') {
            $pdf->SetFillColor(244, 67, 54);
            $pdf->SetTextColor(255, 255, 255);
        } elseif ($status === 'No Time Out') {
            $pdf->SetFillColor(255, 235, 59);
            $pdf->SetTextColor(51, 51, 51);
        }
        $pdf->Cell(38, 8, $status, 1, 1, 'C', true);
        $pdf->SetTextColor(0, 0, 0);
        $pdf->SetFillColor(255, 255, 255);
    }
}

$fromLabel = $dateFrom !== '' ? $dateFrom : 'all';
$toLabel = $dateTo !== '' ? $dateTo : 'latest';
$filename = 'student_attendance_' . $studentId . '_' . $fromLabel . '_to_' . $toLabel . '.pdf';

// Log the export activity
logActivity(
    'EXPORT',
    'STUDENT',
    $student['student_name'],
    "Exported attendance record for student (ID: $studentId, $dateFrom to $dateTo, Status: $statusFilter)"
);

header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
$pdf->Output('D', $filename);
