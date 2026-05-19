<?php
/**
 * Export Student Attendance PDF (ViewRecord)
 * GET /api/students/export_record.php?student_id=...&date_from=...&date_to=...&status=...
 */

// Start output buffering to prevent any stray whitespace from included files
// from corrupting the PDF binary output.
ob_start();

date_default_timezone_set('Asia/Manila');

require_once '../../config/database.php';
require_once '../../utils/cors.php';
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

// Fetch student info (including enrollment/created_at date)
$stmt = $conn->prepare("SELECT student_name, student_course, created_at, enrollment_date FROM students WHERE student_id = :student_id");
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

// Determine status for each actual log
$actualLogs = [];
$datesWithLogs = [];
foreach ($logs as $log) {
    if ($log['time_in'] && $log['time_out']) {
        $status = 'Present';
    } elseif ($log['time_in'] && !$log['time_out']) {
        $status = 'No Time Out';
    } else {
        $status = 'Absent';
    }
    $actualLogs[] = [
        'date' => $log['date'],
        'time_in' => $log['time_in'],
        'time_out' => $log['time_out'],
        'status' => $status,
    ];
    $datesWithLogs[$log['date']] = true;
}

// Generate absent entries for dates without logs (Mon-Sat only)
$enrollmentDateStr = $student['created_at'] ?? $student['enrollment_date'] ?? null;
$absentLogs = [];
if ($enrollmentDateStr) {
    $enrollmentDate = new DateTime($enrollmentDateStr);
    $enrollmentDate->setTime(0, 0, 0);
    $today = new DateTime();
    $today->setTime(0, 0, 0);

    // Start from the later of enrollment date or dateFrom
    $startDate = new DateTime($dateFrom);
    if ($enrollmentDate > $startDate) {
        $startDate = clone $enrollmentDate;
    }

    // End at the earlier of today or dateTo
    $endDate = new DateTime($dateTo);
    if ($today < $endDate) {
        $endDate = clone $today;
    }

    $current = clone $startDate;
    while ($current <= $endDate) {
        $dayOfWeek = (int)$current->format('w'); // 0=Sun, 6=Sat
        $dateStr = $current->format('Y-m-d');

        // Only Mon-Sat (1-6) and no actual log exists for this date
        if ($dayOfWeek !== 0 && !isset($datesWithLogs[$dateStr])) {
            $absentLogs[] = [
                'date' => $dateStr,
                'time_in' => null,
                'time_out' => null,
                'status' => 'Absent',
            ];
        }
        $current->modify('+1 day');
    }
}

// Combine actual logs and absent logs
$allLogs = array_merge($actualLogs, $absentLogs);

// Sort by date ascending
usort($allLogs, function($a, $b) {
    return strcmp($a['date'], $b['date']);
});

// Apply status filter
if ($statusFilter !== 'All' && $statusFilter !== '') {
    $allLogs = array_values(array_filter($allLogs, function($log) use ($statusFilter) {
        return $log['status'] === $statusFilter;
    }));
}

function formatDisplayDate(string $date): string {
    return date('m/d/Y', strtotime($date));
}
function formatTimeDisplay(?string $time): string {
    if (!$time) return 'N/A';
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
$pdf->SetMargins(14, 14, 14);
$pdf->SetAutoPageBreak(true, 18);
$pdf->AddPage($pageOrientation, $pageSize);
$pdf->SetFont('Arial', '', 9);

if (empty($allLogs)) {
    $pdf->SetTextColor(150, 150, 150);
    $pdf->Cell(0, 12, 'No records found for the selected filters.', 0, 1, 'C');
} else {
    // Calculate table width and center position
    $tableWidth = 164; // 12 + 38 + 38 + 38 + 38
    $pageWidth = $pdf->GetPageWidth();
    $leftMargin = ($pageWidth - $tableWidth) / 2;
    
    foreach ($allLogs as $i => $row) {
        $pdf->SetX($leftMargin);
        $pdf->Cell(12, 8, $i+1, 1, 0, 'C');
        $pdf->Cell(38, 8, formatDisplayDate($row['date']), 1, 0, 'C');
        $pdf->Cell(38, 8, formatTimeDisplay($row['time_in']), 1, 0, 'C');
        $pdf->Cell(38, 8, formatTimeDisplay($row['time_out']), 1, 0, 'C');
        
        // Status cell with color
        $status = $row['status'];
        if ($status === 'Present') {
            $pdf->SetTextColor(34, 139, 34);
        } elseif ($status === 'Absent') {
            $pdf->SetTextColor(220, 53, 69);
        } elseif ($status === 'No Time Out') {
            $pdf->SetTextColor(200, 150, 0);
        }
        $pdf->Cell(38, 8, $status, 1, 1, 'C');
        $pdf->SetTextColor(0, 0, 0);
    }
}

$filename = 'student_attendance_' . $studentId . '_' . $dateFrom . '_to_' . $dateTo . '.pdf';

// Log the export activity
logActivity(
    'EXPORT',
    'STUDENT',
    $student['student_name'],
    "Student record exported ($dateFrom to $dateTo)"
);

// Clean any stray output from included files (trailing whitespace after ?> tags)
// This prevents PDF corruption.
if (ob_get_level()) {
    ob_end_clean();
}

header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
$pdf->Output('D', $filename);
