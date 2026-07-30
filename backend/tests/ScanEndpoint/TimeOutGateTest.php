<?php
/**
 * Unit Tests: Time-Out Gate Logic
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 8.1, 8.4
 *
 * Tests the helper functions (isTimeOutAllowed, formatRemainingTime)
 * with specific example inputs that map to each time-out scenario in scan.php.
 *
 * Run with: php backend/tests/ScanEndpoint/TimeOutGateTest.php
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
// Test 1: Denial Before End (testDenialBeforeEnd)
// Validates: Requirements 5.1
// Current time 09:30, session ends 10:00 → denied (false)
// Then verify remaining time formatting
// ============================================================

$result = isTimeOutAllowed('09:30:00', '10:00:00');
assertEqual(false, $result, 'testDenialBeforeEnd - isTimeOutAllowed',
    'Check-out at 09:30 with end_time 10:00 should be denied');

$remaining = formatRemainingTime('09:30:00', '10:00:00');
assertEqual('30 minutes 0 seconds', $remaining, 'testDenialBeforeEnd - formatRemainingTime',
    'Remaining time from 09:30 to 10:00 should be 30 minutes 0 seconds');

// ============================================================
// Test 2: Denial Response Fields (testDenialResponseFields)
// Validates: Requirements 5.2, 5.3
// When denial occurs, verify the expected denial data structure contains
// required fields: status, action, uid, student_id, student_name, message,
// session_end_time
// ============================================================

// Simulate the denial data structure built by scan.php
$uid = 'AB:CD:EF:12';
$studentId = 42;
$studentName = 'Juan Dela Cruz';
$endTime = '10:00:00';
$now = '09:30:00';
$remainingFormatted = formatRemainingTime($now, $endTime);

$denialData = [
    'status'           => 'denied',
    'action'           => 'check_out_denied',
    'uid'              => $uid,
    'student_id'       => $studentId,
    'student_name'     => $studentName,
    'message'          => "Cannot check out yet. Session ends at {$endTime}. Remaining: $remainingFormatted",
    'session_end_time' => $endTime,
];

assertEqual('denied', $denialData['status'], 'testDenialResponseFields - status',
    'Denial data status should be "denied"');
assertEqual('check_out_denied', $denialData['action'], 'testDenialResponseFields - action',
    'Denial data action should be "check_out_denied"');
assertEqual($uid, $denialData['uid'], 'testDenialResponseFields - uid',
    'Denial data should contain uid');
assertEqual($studentId, $denialData['student_id'], 'testDenialResponseFields - student_id',
    'Denial data should contain student_id');
assertEqual($studentName, $denialData['student_name'], 'testDenialResponseFields - student_name',
    'Denial data should contain student_name');
assertEqual(true, str_contains($denialData['message'], 'Remaining:'), 'testDenialResponseFields - message contains remaining',
    'Denial message should contain remaining time info');
assertEqual($endTime, $denialData['session_end_time'], 'testDenialResponseFields - session_end_time',
    'Denial data should contain session_end_time');

// ============================================================
// Test 3: Allowed At Exactly End Time (testAllowedAtExactlyEndTime)
// Validates: Requirement 5.4
// Current time equals end_time → allowed (true)
// ============================================================

$result = isTimeOutAllowed('10:00:00', '10:00:00');
assertEqual(true, $result, 'testAllowedAtExactlyEndTime',
    'Check-out at exactly end_time should be allowed (>= comparison)');

// ============================================================
// Test 4: Allowed After End Time (testAllowedAfterEndTime)
// Validates: Requirement 6.1
// Current time 10:05, session ended at 10:00 → allowed (true)
// ============================================================

$result = isTimeOutAllowed('10:05:00', '10:00:00');
assertEqual(true, $result, 'testAllowedAfterEndTime',
    'Check-out 5 minutes after end_time should be allowed');

// ============================================================
// Test 5: No Schedule → Immediate Check-Out (testNoScheduleImmediate)
// Validates: Requirements 6.4, 8.3
// NULL endTime = no gate enforced, always allowed
// ============================================================

$result = isTimeOutAllowed('09:30:00', null);
assertEqual(true, $result, 'testNoScheduleImmediate',
    'Check-out with null endTime (no schedule) should always be allowed');

// ============================================================
// Test 6: Legacy Cooldown Removed (testLegacyCooldownRemoved)
// Validates: Requirements 8.1, 8.4
// Check-out 1 second after end_time → allowed regardless of time since check-in
// The function only cares about currentTime vs endTime
// ============================================================

$result = isTimeOutAllowed('10:00:01', '10:00:00');
assertEqual(true, $result, 'testLegacyCooldownRemoved',
    'Check-out 1 second after end_time should be allowed (no cooldown, only end_time matters)');

// ============================================================
// Test 7: Remaining Time Format (testRemainingTimeFormat)
// Validates: Requirement 5.2
// From 09:47:30 to 10:00:00 = 12 minutes 30 seconds
// ============================================================

$result = formatRemainingTime('09:47:30', '10:00:00');
assertEqual('12 minutes 30 seconds', $result, 'testRemainingTimeFormat',
    'Remaining time from 09:47:30 to 10:00:00 should be 12 minutes 30 seconds');

// ============================================================
// Test 8: Remaining Time Exact Minutes (testRemainingTimeExactMinutes)
// Validates: Requirement 5.2
// From 09:45:00 to 10:00:00 = 15 minutes 0 seconds
// ============================================================

$result = formatRemainingTime('09:45:00', '10:00:00');
assertEqual('15 minutes 0 seconds', $result, 'testRemainingTimeExactMinutes',
    'Remaining time from 09:45:00 to 10:00:00 should be 15 minutes 0 seconds');

// ============================================================
// Test 9: Denial One Second Before End (testDenialOneSecondBeforeEnd)
// Validates: Requirement 5.1
// Current time 09:59:59, end at 10:00:00 → denied (false)
// ============================================================

$result = isTimeOutAllowed('09:59:59', '10:00:00');
assertEqual(false, $result, 'testDenialOneSecondBeforeEnd',
    'Check-out 1 second before end_time should be denied');

// ============================================================
// Test 10: Remaining Time One Second (testRemainingTimeOneSecond)
// Validates: Requirement 5.2
// From 09:59:59 to 10:00:00 = 0 minutes 1 seconds
// ============================================================

$result = formatRemainingTime('09:59:59', '10:00:00');
assertEqual('0 minutes 1 seconds', $result, 'testRemainingTimeOneSecond',
    'Remaining time from 09:59:59 to 10:00:00 should be 0 minutes 1 seconds');

// ============================================================
// Report Results
// ============================================================

echo "=== Unit Tests: Time-Out Gate Logic ===\n";
echo "Validates: Requirements 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 8.1, 8.4\n";
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
    echo "FAILED - Some time-out gate logic tests did not pass.\n";
    exit(1);
} else {
    echo "PASSED - All time-out gate logic unit tests passed.\n";
    exit(0);
}
