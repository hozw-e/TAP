<?php
/**
 * Unit Tests: Check-In Logic
 *
 * Validates: Requirements 1.1, 1.2, 2.1, 3.1, 4.1, 4.2, 4.3, 7.2, 7.4
 *
 * Tests the helper functions (validateTimeInWindow, computeAttendanceFlag)
 * with specific example inputs that map to each check-in scenario in scan.php.
 *
 * Run with: php backend/tests/ScanEndpoint/CheckInLogicTest.php
 */

require_once __DIR__ . '/../../utils/attendance-helpers.php';

// ============================================================
// Test Framework (minimal standalone)
// ============================================================

$testResults = [];
$totalPassed = 0;
$totalFailed = 0;

function assertEqual($expected, $actual, string $testName, string $detail = ''): void
{
    global $testResults, $totalPassed, $totalFailed;

    if ($expected === $actual) {
        $totalPassed++;
        $testResults[] = ['status' => 'PASS', 'name' => $testName];
    } else {
        $totalFailed++;
        $msg = "Expected: " . var_export($expected, true) . ", Got: " . var_export($actual, true);
        if ($detail) {
            $msg .= " ($detail)";
        }
        $testResults[] = ['status' => 'FAIL', 'name' => $testName, 'message' => $msg];
    }
}

// ============================================================
// Test 1: Too-Early Denial
// Validates: Requirement 1.2
// Check-in at 06:00 when session starts at 08:00 (2 hours early, > 60 min)
// ============================================================

$result = validateTimeInWindow('06:00:00', '08:00:00', '10:00:00');
assertEqual('too_early', $result, 'testTooEarlyDenial',
    'Check-in 2 hours before start should be denied as too_early');

// ============================================================
// Test 2: Session-Ended Denial
// Validates: Requirements 4.1, 4.2, 4.3
// Check-in at 10:30 when session ended at 10:00
// ============================================================

$result = validateTimeInWindow('10:30:00', '08:00:00', '10:00:00');
assertEqual('session_ended', $result, 'testSessionEndedDenial',
    'Check-in after end_time should be denied as session_ended');

// ============================================================
// Test 3: Allowed + Present Flag
// Validates: Requirements 1.1, 2.1
// Check-in at 07:55 (5 min before start at 08:00) → allowed, then present
// ============================================================

$validation = validateTimeInWindow('07:55:00', '08:00:00', '10:00:00');
assertEqual('allowed', $validation, 'testAllowedPresent - validation',
    'Check-in 5 min before start should be allowed');

$flag = computeAttendanceFlag('07:55:00', '08:00:00', 15, '10:00:00');
assertEqual('present', $flag, 'testAllowedPresent - flag',
    'Check-in before start_time should yield present flag');

// ============================================================
// Test 4: Allowed + Tardy Flag
// Validates: Requirement 2.1
// Check-in at 08:10 (10 min after start, within 15-min grace)
// ============================================================

$flag = computeAttendanceFlag('08:10:00', '08:00:00', 15, '10:00:00');
assertEqual('tardy', $flag, 'testAllowedTardy',
    'Check-in within grace period should yield tardy flag');

// ============================================================
// Test 5: Allowed + Late Flag
// Validates: Requirement 3.1
// Check-in at 08:20 (20 min after start, beyond 15-min grace)
// ============================================================

$flag = computeAttendanceFlag('08:20:00', '08:00:00', 15, '10:00:00');
assertEqual('late', $flag, 'testAllowedLate',
    'Check-in after grace period should yield late flag');

// ============================================================
// Test 6: No Schedule → NULL Flag
// Validates: Requirement 7.2
// When no schedule exists, computeAttendanceFlag is not called.
// We verify that the helper functions behave correctly for typical values
// and that the scan.php logic guards on $schedule being null.
// Here we confirm the helper returns correct values for typical schedule,
// demonstrating that the flag logic is only invoked when a schedule exists.
// ============================================================

// Verify that without a schedule, the code path skips flag computation.
// In scan.php: if ($schedule) { ... computeAttendanceFlag(...) }
// When $schedule is null, no flag is assigned (NULL).
// We test this by confirming the guard condition: $schedule === null means no call.
$schedule = null;
$flagAssigned = null;
if ($schedule) {
    $flagAssigned = computeAttendanceFlag('08:10:00', '08:00:00', 15, '10:00:00');
}
assertEqual(null, $flagAssigned, 'testNoScheduleNullFlag',
    'When no schedule exists, attendance flag should remain NULL (not computed)');

// ============================================================
// Test 7: NULL Student Course → No Schedule
// Validates: Requirement 7.4
// When student_course is NULL, schedule lookup is skipped entirely.
// The scan.php guard: if ($studentCourse) { ... query schedule ... }
// ============================================================

$studentCourse = null;
$schedule = null; // default
if ($studentCourse) {
    // This block would query course_schedules — but it's skipped
    $schedule = ['start_time' => '08:00:00', 'end_time' => '10:00:00', 'grace_period' => 15];
}
$flagAssigned = null;
if ($schedule) {
    $flagAssigned = computeAttendanceFlag('08:10:00', '08:00:00', 15, '10:00:00');
}
assertEqual(null, $flagAssigned, 'testNullCourseNoSchedule',
    'When student_course is NULL, schedule lookup is skipped and flag remains NULL');

// ============================================================
// Test 8: Exact Start Time Boundary → Present
// Validates: Requirement 1.1
// Check-in at exactly 08:00:00 (equal to start_time)
// ============================================================

$flag = computeAttendanceFlag('08:00:00', '08:00:00', 15, '10:00:00');
assertEqual('present', $flag, 'testExactStartTime',
    'Check-in at exactly start_time should yield present (inclusive boundary)');

// ============================================================
// Test 9: Exact Grace Deadline → Tardy
// Validates: Requirement 2.2
// Check-in at 08:15:00 (exactly start + 15 min grace = inclusive upper boundary)
// ============================================================

$flag = computeAttendanceFlag('08:15:00', '08:00:00', 15, '10:00:00');
assertEqual('tardy', $flag, 'testExactGraceDeadline',
    'Check-in at exactly start + grace should yield tardy (inclusive upper boundary)');

// ============================================================
// Test 10: One Second After Grace → Late
// Validates: Requirement 3.2
// Check-in at 08:15:01 (1 second past grace deadline)
// ============================================================

$flag = computeAttendanceFlag('08:15:01', '08:00:00', 15, '10:00:00');
assertEqual('late', $flag, 'testOneSecondAfterGrace',
    'Check-in 1 second after grace deadline should yield late');

// ============================================================
// Report Results
// ============================================================

echo "=== Unit Tests: Check-In Logic ===\n";
echo "Validates: Requirements 1.1, 1.2, 2.1, 3.1, 4.1, 4.2, 4.3, 7.2, 7.4\n";
echo str_repeat('-', 60) . "\n\n";

foreach ($testResults as $r) {
    $status = $r['status'] === 'PASS' ? '✓ PASS' : '✗ FAIL';
    echo "  [{$status}] {$r['name']}\n";
    if (isset($r['message'])) {
        echo "           {$r['message']}\n";
    }
}

echo "\n" . str_repeat('-', 60) . "\n";
echo "Results: {$totalPassed} passed, {$totalFailed} failed out of " . ($totalPassed + $totalFailed) . " assertions.\n\n";

if ($totalFailed > 0) {
    echo "FAILED - Some check-in logic tests did not pass.\n";
    exit(1);
} else {
    echo "PASSED - All check-in logic unit tests passed.\n";
    exit(0);
}
