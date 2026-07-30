<?php
/**
 * Property Test: Session-Ended Denial (Property 3)
 * 
 * Validates: Requirements 4.1
 * 
 * Property: For any check-in time that is at or after the session end time,
 * validateTimeInWindow SHALL return "session_ended".
 * 
 * Strategy: Generate random endTime and checkInTime where checkInTime >= endTime.
 * Set startTime such that checkInTime >= startTime - 60 min (to isolate session_ended
 * from too_early condition).
 * 
 * Run with: php backend/tests/AttendanceHelpers/SessionEndedDenialTest.php
 */

require_once __DIR__ . '/../../utils/attendance-helpers.php';

/**
 * Generate a random time string in HH:MM:SS format.
 * 
 * @param int $minSeconds Minimum seconds from midnight (default 0)
 * @param int $maxSeconds Maximum seconds from midnight (default 86399)
 * @return string HH:MM:SS formatted time
 */
function randomTime(int $minSeconds = 0, int $maxSeconds = 86399): string
{
    $seconds = rand($minSeconds, $maxSeconds);
    $h = intdiv($seconds, 3600);
    $m = intdiv($seconds % 3600, 60);
    $s = $seconds % 60;
    return sprintf('%02d:%02d:%02d', $h, $m, $s);
}

/**
 * Convert HH:MM:SS to seconds from midnight.
 */
function timeToSeconds(string $time): int
{
    $parts = explode(':', $time);
    return (int)$parts[0] * 3600 + (int)$parts[1] * 60 + (int)$parts[2];
}

/**
 * Convert seconds from midnight to HH:MM:SS.
 */
function secondsToTime(int $seconds): string
{
    $seconds = max(0, min(86399, $seconds));
    $h = intdiv($seconds, 3600);
    $m = intdiv($seconds % 3600, 60);
    $s = $seconds % 60;
    return sprintf('%02d:%02d:%02d', $h, $m, $s);
}

/**
 * Generate test data for Session-Ended Denial property.
 * 
 * Constraints:
 * - checkInTime >= endTime (session ended condition)
 * - startTime is set so that checkInTime >= startTime - 60 min (avoids too_early)
 * 
 * @return array{checkInTime: string, startTime: string, endTime: string}
 */
function generateSessionEndedCase(): array
{
    // Generate endTime: at least 1 hour from midnight to allow startTime before it
    $endSeconds = rand(3600, 86399);
    
    // Generate checkInTime >= endTime (at or after session end)
    $checkInSeconds = rand($endSeconds, min($endSeconds + 7200, 86399));
    
    // Set startTime so that checkInTime is NOT too early
    // Condition: checkInTime >= startTime - 60 min
    // => startTime <= checkInTime + 60 min
    // Also startTime must be <= endTime (a valid schedule has start before end)
    $maxStartSeconds = min($checkInSeconds + 3600, $endSeconds);
    // startTime must be at least some reasonable value (at least 0)
    $startSeconds = rand(0, $maxStartSeconds);
    
    return [
        'checkInTime' => secondsToTime($checkInSeconds),
        'startTime' => secondsToTime($startSeconds),
        'endTime' => secondsToTime($endSeconds),
    ];
}

// --- Test Execution ---

$iterations = 150;
$passed = 0;
$failed = 0;
$failures = [];

echo "=== Property Test: Session-Ended Denial (Property 3) ===" . PHP_EOL;
echo "Validates: Requirements 4.1" . PHP_EOL;
echo "Iterations: $iterations" . PHP_EOL;
echo "Property: For any checkInTime >= endTime, validateTimeInWindow returns 'session_ended'" . PHP_EOL;
echo str_repeat('-', 70) . PHP_EOL;

for ($i = 1; $i <= $iterations; $i++) {
    $case = generateSessionEndedCase();
    
    $result = validateTimeInWindow($case['checkInTime'], $case['startTime'], $case['endTime']);
    
    if ($result === 'session_ended') {
        $passed++;
    } else {
        $failed++;
        $failures[] = [
            'iteration' => $i,
            'checkInTime' => $case['checkInTime'],
            'startTime' => $case['startTime'],
            'endTime' => $case['endTime'],
            'expected' => 'session_ended',
            'actual' => $result,
        ];
        // Stop early on first failure to report counterexample
        if ($failed >= 5) {
            break;
        }
    }
}

echo PHP_EOL;

if ($failed === 0) {
    echo "RESULT: PASSED" . PHP_EOL;
    echo "All $passed/$iterations iterations returned 'session_ended' as expected." . PHP_EOL;
    exit(0);
} else {
    echo "RESULT: FAILED" . PHP_EOL;
    echo "Passed: $passed, Failed: $failed" . PHP_EOL;
    echo PHP_EOL . "Counterexamples:" . PHP_EOL;
    foreach ($failures as $f) {
        echo "  Iteration {$f['iteration']}: checkInTime={$f['checkInTime']}, startTime={$f['startTime']}, endTime={$f['endTime']}" . PHP_EOL;
        echo "    Expected: {$f['expected']}, Got: {$f['actual']}" . PHP_EOL;
    }
    exit(1);
}
