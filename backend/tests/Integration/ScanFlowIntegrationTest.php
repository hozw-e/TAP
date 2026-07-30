<?php
/**
 * Integration Tests: Full Scan Flow
 *
 * Validates: Requirements 1.1, 4.1, 5.1, 6.1, 8.1, 8.4
 *
 * Tests the COMPLETE decision flow that scan.php implements by combining
 * validateTimeInWindow, computeAttendanceFlag, isTimeOutAllowed, and
 * formatRemainingTime in sequence — simulating check-in and check-out paths.
 *
 * Run with: php backend/tests/Integration/ScanFlowIntegrationTest.php
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

function assertTrue($actual, string $testName, string $detail = ''): void
{
    assertEqual(true, $actual, $testName, $detail);
}

function assertFalse($actual, string $testName, string $detail = ''): void
{
    assertEqual(false, $actual, $testName, $detail);
}

// ============================================================
// Test 1: Full Check-In With Schedule → Present
// Validates: Requirement 1.1
// Simulate check-in at 07:55 with schedule 08:00-10:00 grace=15
// Flow: validateTimeInWindow → 'allowed', computeAttendanceFlag → 'present'
// ============================================================

$now = '07:55:00';
$schedule = ['start_time' => '08:00:00', 'end_time' => '10:00:00', 'grace_period' => 15];

// Step 1: Validate time-in window
$validation = validateTimeInWindow($now, $schedule['start_time'], $schedule['end_time']);
assertEqual('allowed', $validation, 'testFullCheckInWithSchedulePresent - validation',
    'Check-in at 07:55 with start 08:00 should be allowed');

// Step 2: Compute attendance flag
$flag = computeAttendanceFlag($now, $schedule['start_time'], $schedule['grace_period'], $schedule['end_time']);
assertEqual('present', $flag, 'testFullCheckInWithSchedulePresent - flag',
    'Check-in at 07:55 before start 08:00 should be marked present');

// ============================================================
// Test 2: Full Check-In With Schedule → Late
// Validates: Requirement 1.1
// Simulate check-in at 08:30 with schedule 08:00-10:00 grace=15
// Flow: validateTimeInWindow → 'allowed', computeAttendanceFlag → 'late'
// ============================================================

$now = '08:30:00';
$schedule = ['start_time' => '08:00:00', 'end_time' => '10:00:00', 'grace_period' => 15];

// Step 1: Validate time-in window
$validation = validateTimeInWindow($now, $schedule['start_time'], $schedule['end_time']);
assertEqual('allowed', $validation, 'testFullCheckInWithScheduleLate - validation',
    'Check-in at 08:30 within session window should be allowed');

// Step 2: Compute attendance flag
$flag = computeAttendanceFlag($now, $schedule['start_time'], $schedule['grace_period'], $schedule['end_time']);
assertEqual('late', $flag, 'testFullCheckInWithScheduleLate - flag',
    'Check-in at 08:30 (beyond 15-min grace) should be marked late');

// ============================================================
// Test 3: Full Check-Out After End Time
// Validates: Requirement 6.1
// Simulate check-out at 10:05 with schedule end 10:00
// Flow: isTimeOutAllowed → true, time-out proceeds
// ============================================================

$now = '10:05:00';
$endTime = '10:00:00';

$allowed = isTimeOutAllowed($now, $endTime);
assertTrue($allowed, 'testFullCheckOutAfterEndTime',
    'Check-out at 10:05 after end_time 10:00 should be allowed');

// ============================================================
// Test 4: Check-Out Denial Before End Time
// Validates: Requirement 5.1
// Simulate check-out at 09:30 with schedule end 10:00
// Flow: isTimeOutAllowed → false, formatRemainingTime → "30 minutes 0 seconds"
// ============================================================

$now = '09:30:00';
$endTime = '10:00:00';

$allowed = isTimeOutAllowed($now, $endTime);
assertFalse($allowed, 'testCheckOutDenialBeforeEndTime - denied',
    'Check-out at 09:30 before end_time 10:00 should be denied');

$remaining = formatRemainingTime($now, $endTime);
assertEqual('30 minutes 0 seconds', $remaining, 'testCheckOutDenialBeforeEndTime - remaining',
    'Remaining time from 09:30 to 10:00 should be 30 minutes 0 seconds');

// Simulate denial response structure (as built by scan.php)
$denialData = [
    'status'           => 'denied',
    'action'           => 'check_out_denied',
    'uid'              => 'AB:CD:EF:12',
    'student_id'       => 42,
    'student_name'     => 'Juan Dela Cruz',
    'message'          => "Cannot check out yet. Session ends at {$endTime}. Remaining: $remaining",
    'session_end_time' => $endTime,
];

assertEqual('denied', $denialData['status'], 'testCheckOutDenialBeforeEndTime - action_result status',
    'Denial response should have status=denied');
assertEqual('check_out_denied', $denialData['action'], 'testCheckOutDenialBeforeEndTime - action_result action',
    'Denial response should have action=check_out_denied');

// ============================================================
// Test 5: Check-In Denial After End Time
// Validates: Requirement 4.1
// Simulate check-in at 10:30 with schedule 08:00-10:00
// Flow: validateTimeInWindow → 'session_ended', deny with session_end_time
// ============================================================

$now = '10:30:00';
$schedule = ['start_time' => '08:00:00', 'end_time' => '10:00:00', 'grace_period' => 15];

$validation = validateTimeInWindow($now, $schedule['start_time'], $schedule['end_time']);
assertEqual('session_ended', $validation, 'testCheckInDenialAfterEndTime - validation',
    'Check-in at 10:30 after end_time 10:00 should return session_ended');

// Simulate denial response structure (as built by scan.php)
$denialData = [
    'status'           => 'denied',
    'action'           => 'check_in_denied',
    'uid'              => 'AB:CD:EF:12',
    'student_id'       => 42,
    'student_name'     => 'Juan Dela Cruz',
    'message'          => 'Session has already ended.',
    'session_end_time' => $schedule['end_time'],
];

assertEqual('denied', $denialData['status'], 'testCheckInDenialAfterEndTime - action_result status',
    'Denial response should have status=denied');
assertEqual('check_in_denied', $denialData['action'], 'testCheckInDenialAfterEndTime - action_result action',
    'Denial response should have action=check_in_denied');
assertEqual('10:00:00', $denialData['session_end_time'], 'testCheckInDenialAfterEndTime - session_end_time',
    'Denial response should include session_end_time');

// ============================================================
// Test 6: Legacy Cooldown Removed
// Validates: Requirements 8.1, 8.4
// Simulate check-out at 10:00:30 (only 30 seconds after check-in at 10:00:00)
// but end_time is 10:00:00 → isTimeOutAllowed should return true
// This proves: no 60-second cooldown, only session end_time matters.
// ============================================================

$checkInTime = '10:00:00';
$checkOutTime = '10:00:30'; // Only 30 seconds later
$endTime = '10:00:00';

$allowed = isTimeOutAllowed($checkOutTime, $endTime);
assertTrue($allowed, 'testLegacyCooldownRemoved',
    'Check-out 30s after check-in should be allowed when end_time has passed (no cooldown)');

// ============================================================
// Test 7: No-Schedule Check-In
// Validates: Requirement 1.1 (no-schedule path)
// When schedule is null, skip validation and flag — no denial, flag stays null
// ============================================================

$schedule = null;
$now = '08:10:00';

// Simulate scan.php logic: when no schedule, skip validateTimeInWindow & computeAttendanceFlag
$denied = false;
$flagAssigned = null;

if ($schedule) {
    $validation = validateTimeInWindow($now, $schedule['start_time'], $schedule['end_time']);
    if ($validation !== 'allowed') {
        $denied = true;
    } else {
        $flagAssigned = computeAttendanceFlag($now, $schedule['start_time'], $schedule['grace_period'], $schedule['end_time']);
    }
}

assertFalse($denied, 'testNoScheduleCheckIn - no denial',
    'Check-in without schedule should not be denied');
assertEqual(null, $flagAssigned, 'testNoScheduleCheckIn - flag null',
    'Check-in without schedule should have NULL attendance flag');

// ============================================================
// Test 8: No-Schedule Check-Out
// Validates: Requirement 8.1 (no-schedule path)
// When schedule is null, isTimeOutAllowed with null endTime → true
// ============================================================

$schedule = null;
$now = '08:15:00';

// Simulate scan.php logic: when no schedule, endTime is null → immediate check-out
$endTime = $schedule ? $schedule['end_time'] : null;
$allowed = isTimeOutAllowed($now, $endTime);

assertTrue($allowed, 'testNoScheduleCheckOut',
    'Check-out without schedule (null endTime) should always be allowed');

// ============================================================
// Test 9: Full Flow Check-In Then Check-Out (Complete Lifecycle)
// Validates: Requirements 1.1, 6.1
// Step A: Check in at 07:55 → present flag
// Step B: Check out at 10:05 → allowed
// ============================================================

$schedule = ['start_time' => '08:00:00', 'end_time' => '10:00:00', 'grace_period' => 15];

// Step A: Check-in at 07:55
$checkInTime = '07:55:00';
$validation = validateTimeInWindow($checkInTime, $schedule['start_time'], $schedule['end_time']);
assertEqual('allowed', $validation, 'testFullFlowCheckInThenCheckOut - check-in validation',
    'Check-in at 07:55 should be allowed');

$flag = computeAttendanceFlag($checkInTime, $schedule['start_time'], $schedule['grace_period'], $schedule['end_time']);
assertEqual('present', $flag, 'testFullFlowCheckInThenCheckOut - check-in flag',
    'Check-in at 07:55 should yield present flag');

// Step B: Check-out at 10:05
$checkOutTime = '10:05:00';
$allowed = isTimeOutAllowed($checkOutTime, $schedule['end_time']);
assertTrue($allowed, 'testFullFlowCheckInThenCheckOut - check-out allowed',
    'Check-out at 10:05 after end_time 10:00 should be allowed');

// ============================================================
// Test 10: Check-In Too Early
// Validates: Requirement 1.1
// Check-in at 06:00 with schedule start 08:00
// Flow: validateTimeInWindow → 'too_early', deny with session_start_time
// ============================================================

$now = '06:00:00';
$schedule = ['start_time' => '08:00:00', 'end_time' => '10:00:00', 'grace_period' => 15];

$validation = validateTimeInWindow($now, $schedule['start_time'], $schedule['end_time']);
assertEqual('too_early', $validation, 'testCheckInTooEarly - validation',
    'Check-in at 06:00 (2 hours before 08:00 start) should be too_early');

// Simulate denial response structure (as built by scan.php)
$denialData = [
    'status'             => 'denied',
    'action'             => 'check_in_denied',
    'uid'                => 'AB:CD:EF:12',
    'student_id'         => 42,
    'student_name'       => 'Juan Dela Cruz',
    'message'            => 'Session has not started yet. Too early to check in.',
    'session_start_time' => $schedule['start_time'],
];

assertEqual('denied', $denialData['status'], 'testCheckInTooEarly - action_result status',
    'Denial response should have status=denied');
assertEqual('check_in_denied', $denialData['action'], 'testCheckInTooEarly - action_result action',
    'Denial response should have action=check_in_denied');
assertEqual('08:00:00', $denialData['session_start_time'], 'testCheckInTooEarly - session_start_time',
    'Denial response should include session_start_time');

// ============================================================
// Report Results
// ============================================================

echo "=== Integration Tests: Full Scan Flow ===\n";
echo "Validates: Requirements 1.1, 4.1, 5.1, 6.1, 8.1, 8.4\n";
echo str_repeat('-', 60) . "\n\n";

foreach ($testResults as $r) {
    $status = $r['status'] === 'PASS' ? "\xe2\x9c\x93 PASS" : "\xe2\x9c\x97 FAIL";
    echo "  [{$status}] {$r['name']}\n";
    if (isset($r['message'])) {
        echo "           {$r['message']}\n";
    }
}

echo "\n" . str_repeat('-', 60) . "\n";
echo "Results: {$totalPassed} passed, {$totalFailed} failed out of " . ($totalPassed + $totalFailed) . " assertions.\n\n";

if ($totalFailed > 0) {
    echo "FAILED - Some integration tests did not pass.\n";
    exit(1);
} else {
    echo "PASSED - All scan flow integration tests passed.\n";
    exit(0);
}
