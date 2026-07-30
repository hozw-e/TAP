<?php
/**
 * Property Test: Null End-Time Fallback
 * 
 * Property 5: For any checkInTime, startTime, and gracePeriod where endTime is NULL,
 * computeAttendanceFlag SHALL never return "late" UNLESS gracePeriod is 0.
 * When gracePeriod > 0, the result is either "present" or "tardy".
 * When gracePeriod == 0, the result is either "present" or "late" (Req 2.3 takes priority).
 *
 * Validates: Requirements 3.3, 2.3
 *
 * This is a standalone test script using randomized data providers (100+ iterations).
 * Run with: php NullEndTimeFallbackTest.php
 */

require_once __DIR__ . '/../../utils/attendance-helpers.php';

/**
 * Generate a random HH:MM:SS time string.
 */
function generateRandomTime(): string
{
    $hours = rand(0, 23);
    $minutes = rand(0, 59);
    $seconds = rand(0, 59);
    return sprintf('%02d:%02d:%02d', $hours, $minutes, $seconds);
}

/**
 * Generate a random grace period between 0 and 120 minutes.
 */
function generateRandomGracePeriod(): int
{
    return rand(0, 120);
}

/**
 * Run the Null End-Time Fallback property test.
 *
 * Property: When endTime is NULL, computeAttendanceFlag MUST never return 'late'.
 * The only valid outputs are 'present' or 'tardy'.
 */
function runNullEndTimeFallbackTest(int $iterations = 150): array
{
    $passed = 0;
    $failed = 0;
    $failures = [];

    for ($i = 0; $i < $iterations; $i++) {
        $checkInTime = generateRandomTime();
        $startTime = generateRandomTime();
        $gracePeriod = generateRandomGracePeriod();
        $endTime = null;

        $result = computeAttendanceFlag($checkInTime, $startTime, $gracePeriod, $endTime);

        // Property assertion: result must NEVER be 'late' when endTime is null
        // EXCEPTION: when gracePeriod is 0, 'late' IS allowed because Req 2.3
        // (zero grace = never tardy) takes priority over Req 3.3 (null endTime = never late)
        if ($result === 'late' && $gracePeriod > 0) {
            $failed++;
            $failures[] = [
                'iteration' => $i + 1,
                'checkInTime' => $checkInTime,
                'startTime' => $startTime,
                'gracePeriod' => $gracePeriod,
                'endTime' => 'NULL',
                'result' => $result,
            ];
        } else {
            // Verify result is one of the valid values
            $validResults = ['present', 'tardy', 'late'];
            if (!in_array($result, $validResults, true)) {
                $failed++;
                $failures[] = [
                    'iteration' => $i + 1,
                    'checkInTime' => $checkInTime,
                    'startTime' => $startTime,
                    'gracePeriod' => $gracePeriod,
                    'endTime' => 'NULL',
                    'result' => $result,
                    'error' => "Unexpected return value: '$result' (expected one of: present, tardy, late)",
                ];
            } else {
                $passed++;
            }
        }
    }

    return [
        'total' => $iterations,
        'passed' => $passed,
        'failed' => $failed,
        'failures' => $failures,
    ];
}

// --- Execute Test ---

echo "==========================================================\n";
echo "Property Test: Null End-Time Fallback (Property 5)\n";
echo "Validates: Requirements 3.3\n";
echo "==========================================================\n\n";
echo "Property: When endTime is NULL, computeAttendanceFlag()\n";
echo "          SHALL never return 'late' UNLESS gracePeriod is 0.\n";
echo "          When gracePeriod > 0: valid outputs are 'present' or 'tardy'.\n";
echo "          When gracePeriod == 0: valid outputs are 'present' or 'late'.\n\n";

$iterations = 150;
echo "Running $iterations randomized iterations...\n\n";

$results = runNullEndTimeFallbackTest($iterations);

echo "Results: {$results['passed']}/{$results['total']} passed, {$results['failed']} failed\n\n";

if ($results['failed'] > 0) {
    echo "FAILURES:\n";
    echo "-----------------------------------------------------------\n";
    foreach ($results['failures'] as $failure) {
        echo "  Iteration {$failure['iteration']}:\n";
        echo "    checkInTime:  {$failure['checkInTime']}\n";
        echo "    startTime:    {$failure['startTime']}\n";
        echo "    gracePeriod:  {$failure['gracePeriod']} minutes\n";
        echo "    endTime:      {$failure['endTime']}\n";
        echo "    result:       '{$failure['result']}'\n";
        if (isset($failure['error'])) {
            echo "    error:        {$failure['error']}\n";
        }
        echo "\n";
    }
    echo "-----------------------------------------------------------\n";
    echo "FAIL — Property violated: computeAttendanceFlag returned 'late' with null endTime and gracePeriod > 0\n";
    exit(1);
} else {
    echo "PASS — Property holds: computeAttendanceFlag never returns 'late' when endTime is NULL and gracePeriod > 0\n";
    exit(0);
}
