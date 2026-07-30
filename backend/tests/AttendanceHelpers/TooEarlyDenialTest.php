<?php
/**
 * Property Test: Too-Early Denial
 * 
 * Property 2: For any check-in time that is more than 60 minutes before 
 * the session start time, validateTimeInWindow SHALL return "too_early".
 *
 * Validates: Requirements 1.2
 *
 * This is a standalone test script using PHPUnit-style data providers
 * with 100+ randomized iterations. Run with: php TooEarlyDenialTest.php
 */

require_once __DIR__ . '/../../utils/attendance-helpers.php';

/**
 * Generate a random HH:MM:SS time string.
 * 
 * @param int $minSeconds Minimum seconds from midnight (inclusive)
 * @param int $maxSeconds Maximum seconds from midnight (inclusive)
 * @return string HH:MM:SS formatted time
 */
function generateRandomTime(int $minSeconds, int $maxSeconds): string
{
    $seconds = rand($minSeconds, $maxSeconds);
    $h = intdiv($seconds, 3600);
    $m = intdiv($seconds % 3600, 60);
    $s = $seconds % 60;
    return sprintf('%02d:%02d:%02d', $h, $m, $s);
}

/**
 * Data provider: generates 150 random test cases where checkInTime is
 * more than 60 minutes before startTime.
 *
 * Strategy:
 * - Generate a random startTime that leaves room for at least 61 minutes before it
 *   (startTime must be at least 01:01:00 = 3660 seconds from midnight)
 * - Generate checkInTime that is strictly more than 60 minutes (3600 seconds) before startTime
 *   i.e., checkInTime < startTime - 3600
 * - endTime can be null or any time after startTime (doesn't affect too_early logic)
 *
 * @return array[] Array of [checkInTime, startTime, endTime] tuples
 */
function tooEarlyDenialDataProvider(): array
{
    $cases = [];
    $iterations = 150;

    for ($i = 0; $i < $iterations; $i++) {
        // startTime: must be at least 3661 seconds from midnight so there's room for too-early times
        // Range: 01:01:01 (3661s) to 23:59:59 (86399s)
        $startSeconds = rand(3661, 86399);
        $startTime = generateRandomTime($startSeconds, $startSeconds);

        // checkInTime: must be more than 60 minutes (3600 seconds) before startTime
        // So checkInTime < startTime - 3600
        // Range: 00:00:00 (0s) to startTime - 3601 seconds
        $maxCheckInSeconds = $startSeconds - 3601; // ensures strictly more than 60 min before
        $checkInSeconds = rand(0, $maxCheckInSeconds);
        $checkInTime = generateRandomTime($checkInSeconds, $checkInSeconds);

        // endTime: randomly null or a valid time after startTime
        if (rand(0, 2) === 0) {
            $endTime = null;
        } else {
            // endTime between startTime + 1 minute and 23:59:59
            $endSeconds = rand($startSeconds + 60, min(86399, $startSeconds + 14400));
            $endTime = generateRandomTime($endSeconds, $endSeconds);
        }

        $cases[] = [$checkInTime, $startTime, $endTime];
    }

    return $cases;
}

// ============================================================
// Test Execution
// ============================================================

echo "==========================================================\n";
echo "Property Test: Too-Early Denial\n";
echo "Validates: Requirements 1.2\n";
echo "==========================================================\n\n";

$testCases = tooEarlyDenialDataProvider();
$passed = 0;
$failed = 0;
$failures = [];

foreach ($testCases as $index => $case) {
    [$checkInTime, $startTime, $endTime] = $case;

    $result = validateTimeInWindow($checkInTime, $startTime, $endTime);

    if ($result === 'too_early') {
        $passed++;
    } else {
        $failed++;
        $failures[] = [
            'iteration' => $index + 1,
            'checkInTime' => $checkInTime,
            'startTime' => $startTime,
            'endTime' => $endTime,
            'expected' => 'too_early',
            'actual' => $result,
        ];
    }
}

echo "Iterations: " . count($testCases) . "\n";
echo "Passed: {$passed}\n";
echo "Failed: {$failed}\n\n";

if ($failed > 0) {
    echo "FAILURES:\n";
    echo "----------\n";
    foreach ($failures as $failure) {
        echo "  Iteration #{$failure['iteration']}:\n";
        echo "    checkInTime: {$failure['checkInTime']}\n";
        echo "    startTime:   {$failure['startTime']}\n";
        echo "    endTime:     " . ($failure['endTime'] ?? 'NULL') . "\n";
        echo "    Expected:    {$failure['expected']}\n";
        echo "    Actual:      {$failure['actual']}\n\n";
    }
    echo "RESULT: FAILED\n";
    exit(1);
} else {
    echo "All {$passed} iterations passed.\n";
    echo "RESULT: PASSED\n";
    exit(0);
}
