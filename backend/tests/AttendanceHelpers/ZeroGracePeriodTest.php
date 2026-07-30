<?php
/**
 * Property Test 4: Zero Grace Period Eliminates Tardy
 *
 * Validates: Requirements 2.3
 *
 * Property: For any checkInTime and startTime where gracePeriod = 0,
 * computeAttendanceFlag() SHALL never return "tardy" — the result is
 * either "present" (checkInTime <= startTime) or "late" (checkInTime > startTime).
 *
 * This is a standalone test script using randomized data providers with 150 iterations.
 * Run with: php backend/tests/AttendanceHelpers/ZeroGracePeriodTest.php
 */

require_once __DIR__ . '/../../utils/attendance-helpers.php';

/**
 * Generate a random time string in HH:MM:SS format.
 *
 * @param int $minSeconds Minimum seconds from midnight (inclusive)
 * @param int $maxSeconds Maximum seconds from midnight (inclusive)
 * @return string HH:MM:SS formatted time
 */
function generateRandomTime(int $minSeconds = 0, int $maxSeconds = 86399): string
{
    $seconds = rand($minSeconds, $maxSeconds);
    $h = intdiv($seconds, 3600);
    $m = intdiv($seconds % 3600, 60);
    $s = $seconds % 60;
    return sprintf('%02d:%02d:%02d', $h, $m, $s);
}

/**
 * Convert HH:MM:SS to seconds from midnight for comparison.
 */
function timeToSeconds(string $time): int
{
    $parts = explode(':', $time);
    return (int)$parts[0] * 3600 + (int)$parts[1] * 60 + (int)$parts[2];
}

/**
 * Generate a valid test case with startTime, endTime (start < end),
 * and a checkInTime that falls within the allowed check-in window.
 *
 * @return array{checkInTime: string, startTime: string, endTime: string|null}
 */
function generateTestCase(): array
{
    // Generate startTime between 01:00:00 and 20:00:00 (to leave room for window)
    $startSeconds = rand(3600, 72000);
    $startTime = sprintf('%02d:%02d:%02d', intdiv($startSeconds, 3600), intdiv($startSeconds % 3600, 60), $startSeconds % 60);

    // Decide if endTime is non-null (80% chance) or null (20% chance)
    $hasEndTime = rand(1, 100) <= 80;

    if ($hasEndTime) {
        // endTime must be after startTime, at least 30 minutes and up to 4 hours later
        $endOffset = rand(1800, 14400); // 30 min to 4 hours
        $endSeconds = min($startSeconds + $endOffset, 86399);
        $endTime = sprintf('%02d:%02d:%02d', intdiv($endSeconds, 3600), intdiv($endSeconds % 3600, 60), $endSeconds % 60);

        // checkInTime within allowed window: [startTime - 60min, endTime)
        $earliestCheckIn = max(0, $startSeconds - 3600);
        $latestCheckIn = $endSeconds - 1; // strictly before endTime
        $checkInSeconds = rand($earliestCheckIn, $latestCheckIn);
    } else {
        $endTime = null;

        // checkInTime within allowed window: [startTime - 60min, startTime + 4hours]
        $earliestCheckIn = max(0, $startSeconds - 3600);
        $latestCheckIn = min($startSeconds + 14400, 86399);
        $checkInSeconds = rand($earliestCheckIn, $latestCheckIn);
    }

    $checkInTime = sprintf('%02d:%02d:%02d', intdiv($checkInSeconds, 3600), intdiv($checkInSeconds % 3600, 60), $checkInSeconds % 60);

    return [
        'checkInTime' => $checkInTime,
        'startTime' => $startTime,
        'endTime' => $endTime,
    ];
}

// --- Test Execution ---

$iterations = 150;
$passed = 0;
$failed = 0;
$failures = [];

echo "=== Property Test 4: Zero Grace Period Eliminates Tardy ===\n";
echo "Validates: Requirements 2.3\n";
echo "Iterations: {$iterations}\n";
echo "Property: computeAttendanceFlag() with gracePeriod=0 NEVER returns 'tardy'\n";
echo str_repeat('-', 70) . "\n\n";

for ($i = 1; $i <= $iterations; $i++) {
    $testCase = generateTestCase();
    $checkInTime = $testCase['checkInTime'];
    $startTime = $testCase['startTime'];
    $endTime = $testCase['endTime'];
    $gracePeriod = 0; // Always zero for this property test

    $result = computeAttendanceFlag($checkInTime, $startTime, $gracePeriod, $endTime);

    if ($result === 'tardy') {
        $failed++;
        $endTimeDisplay = $endTime ?? 'NULL';
        $failures[] = [
            'iteration' => $i,
            'checkInTime' => $checkInTime,
            'startTime' => $startTime,
            'endTime' => $endTimeDisplay,
            'gracePeriod' => $gracePeriod,
            'result' => $result,
        ];
    } else {
        // Verify result is either 'present' or 'late'
        if ($result !== 'present' && $result !== 'late') {
            $failed++;
            $endTimeDisplay = $endTime ?? 'NULL';
            $failures[] = [
                'iteration' => $i,
                'checkInTime' => $checkInTime,
                'startTime' => $startTime,
                'endTime' => $endTimeDisplay,
                'gracePeriod' => $gracePeriod,
                'result' => $result,
                'error' => "Unexpected result: expected 'present' or 'late', got '{$result}'",
            ];
        } else {
            $passed++;
        }
    }
}

// --- Results ---

echo "Results: {$passed} passed, {$failed} failed out of {$iterations} iterations\n\n";

if ($failed > 0) {
    echo "FAILURES:\n";
    foreach ($failures as $failure) {
        echo "  Iteration {$failure['iteration']}:\n";
        echo "    checkInTime: {$failure['checkInTime']}\n";
        echo "    startTime:   {$failure['startTime']}\n";
        echo "    endTime:     {$failure['endTime']}\n";
        echo "    gracePeriod: {$failure['gracePeriod']}\n";
        echo "    result:      {$failure['result']}\n";
        if (isset($failure['error'])) {
            echo "    error:       {$failure['error']}\n";
        }
        echo "\n";
    }
    echo "PROPERTY TEST FAILED\n";
    exit(1);
} else {
    echo "ALL ITERATIONS PASSED\n";
    echo "Property holds: computeAttendanceFlag() with gracePeriod=0 never returns 'tardy'\n";
    exit(0);
}
