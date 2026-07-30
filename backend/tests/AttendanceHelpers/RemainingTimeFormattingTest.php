<?php
/**
 * Property Test: Remaining Time Formatting Accuracy
 * 
 * Property 7: For any pair of (currentTime, endTime) where currentTime < endTime,
 * formatRemainingTime SHALL produce a string whose described minutes and seconds
 * sum to exactly (endTime - currentTime) in seconds.
 *
 * Validates: Requirements 5.2
 *
 * This is a standalone test script using randomized data providers (100+ iterations).
 * Run with: php RemainingTimeFormattingTest.php
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
 * Generate a random (currentTime, endTime) pair where currentTime < endTime.
 * Ensures a valid positive difference exists between the two times.
 */
function generateTimePairCurrentBeforeEnd(): array
{
    // Generate endTime with at least 1 second of room before it
    $endHours = rand(0, 23);
    $endMinutes = rand(0, 59);
    $endSeconds = rand(0, 59);

    $endTotalSeconds = $endHours * 3600 + $endMinutes * 60 + $endSeconds;

    // Ensure at least 1 second difference
    if ($endTotalSeconds < 1) {
        $endTotalSeconds = rand(1, 86399);
        $endHours = intdiv($endTotalSeconds, 3600);
        $endMinutes = intdiv($endTotalSeconds % 3600, 60);
        $endSeconds = $endTotalSeconds % 60;
    }

    // Generate currentTime strictly less than endTime
    $currentTotalSeconds = rand(0, $endTotalSeconds - 1);
    $currentHours = intdiv($currentTotalSeconds, 3600);
    $currentMinutes = intdiv($currentTotalSeconds % 3600, 60);
    $currentSeconds = $currentTotalSeconds % 60;

    $currentTime = sprintf('%02d:%02d:%02d', $currentHours, $currentMinutes, $currentSeconds);
    $endTime = sprintf('%02d:%02d:%02d', $endHours, $endMinutes, $endSeconds);

    return [$currentTime, $endTime];
}

/**
 * Parse a formatted remaining time string into total seconds.
 * Expected format: "X minutes Y seconds"
 *
 * @param string $formatted The formatted string from formatRemainingTime()
 * @return int|null Total seconds parsed, or null if parsing fails
 */
function parseFormattedTime(string $formatted): ?int
{
    // Match pattern: "<digits> minutes <digits> seconds"
    if (preg_match('/^(\d+)\s+minutes\s+(\d+)\s+seconds$/', $formatted, $matches)) {
        $minutes = (int) $matches[1];
        $seconds = (int) $matches[2];
        return $minutes * 60 + $seconds;
    }
    return null;
}

/**
 * Run the Remaining Time Formatting Accuracy property test.
 *
 * Property: For any (currentTime, endTime) where currentTime < endTime,
 * the formatted string's minutes*60 + seconds must equal the actual difference in seconds.
 */
function runRemainingTimeFormattingTest(int $iterations = 150): array
{
    $passed = 0;
    $failed = 0;
    $failures = [];

    for ($i = 0; $i < $iterations; $i++) {
        [$currentTime, $endTime] = generateTimePairCurrentBeforeEnd();

        $formatted = formatRemainingTime($currentTime, $endTime);

        // Calculate expected difference in seconds
        $expectedDiff = strtotime($endTime) - strtotime($currentTime);

        // Parse the formatted string
        $parsedSeconds = parseFormattedTime($formatted);

        if ($parsedSeconds === null) {
            $failed++;
            $failures[] = [
                'iteration' => $i + 1,
                'currentTime' => $currentTime,
                'endTime' => $endTime,
                'formatted' => $formatted,
                'expectedDiff' => $expectedDiff,
                'error' => "Failed to parse formatted string: '$formatted'",
            ];
        } elseif ($parsedSeconds !== $expectedDiff) {
            $failed++;
            $failures[] = [
                'iteration' => $i + 1,
                'currentTime' => $currentTime,
                'endTime' => $endTime,
                'formatted' => $formatted,
                'expectedDiff' => $expectedDiff,
                'parsedSeconds' => $parsedSeconds,
                'error' => "Mismatch: parsed $parsedSeconds seconds but expected $expectedDiff seconds",
            ];
        } else {
            $passed++;
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
echo "Property Test: Remaining Time Formatting Accuracy (Property 7)\n";
echo "Validates: Requirements 5.2\n";
echo "==========================================================\n\n";
echo "Property: For any (currentTime, endTime) where currentTime < endTime,\n";
echo "          formatRemainingTime() SHALL produce a string whose\n";
echo "          minutes*60 + seconds equals (endTime - currentTime) in seconds.\n\n";

$iterations = 150;
echo "Running $iterations randomized iterations...\n\n";

$results = runRemainingTimeFormattingTest($iterations);

echo "Results: {$results['passed']}/{$results['total']} passed, {$results['failed']} failed\n\n";

if ($results['failed'] > 0) {
    echo "FAILURES:\n";
    echo "-----------------------------------------------------------\n";
    foreach ($results['failures'] as $failure) {
        echo "  Iteration {$failure['iteration']}:\n";
        echo "    currentTime:    {$failure['currentTime']}\n";
        echo "    endTime:        {$failure['endTime']}\n";
        echo "    formatted:      '{$failure['formatted']}'\n";
        echo "    expectedDiff:   {$failure['expectedDiff']} seconds\n";
        if (isset($failure['parsedSeconds'])) {
            echo "    parsedSeconds:  {$failure['parsedSeconds']} seconds\n";
        }
        echo "    error:          {$failure['error']}\n";
        echo "\n";
    }
    echo "-----------------------------------------------------------\n";
    echo "FAIL — Property violated: formatted remaining time does not match actual difference\n";
    exit(1);
} else {
    echo "PASS — Property holds: formatted remaining time accurately represents time difference\n";
    exit(0);
}
