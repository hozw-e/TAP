<?php
/**
 * Property Test: Time-Out Gate Correctness
 * 
 * Property 6: For any currentTime and endTime:
 * - If endTime is NULL, isTimeOutAllowed SHALL return true (no gate enforced)
 * - If currentTime < endTime, isTimeOutAllowed SHALL return false
 * - If currentTime >= endTime, isTimeOutAllowed SHALL return true
 *
 * This property is independent of elapsed time since check-in —
 * the function only depends on current time vs. end time.
 *
 * Validates: Requirements 5.1, 5.4, 6.1, 8.1, 8.2, 8.3
 *
 * This is a standalone test script using randomized data providers (100+ iterations).
 * Run with: php TimeOutGateTest.php
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
 * Generate a random time that is strictly before the given time.
 * Returns a time at least 1 second before $time.
 */
function generateTimeBefore(string $time): string
{
    $timestamp = strtotime($time);
    // Generate a random offset between 1 second and the time value itself (capped at 4 hours)
    $maxOffset = min($timestamp - strtotime('00:00:00'), 4 * 3600);
    if ($maxOffset < 1) {
        $maxOffset = 1;
    }
    $offset = rand(1, $maxOffset);
    $earlier = $timestamp - $offset;
    return date('H:i:s', $earlier);
}

/**
 * Generate a random time that is at or after the given time.
 * Returns a time that is >= $time.
 */
function generateTimeAtOrAfter(string $time): string
{
    $timestamp = strtotime($time);
    // Generate a random offset between 0 seconds and remaining time until end of day (capped at 4 hours)
    $maxOffset = min(strtotime('23:59:59') - $timestamp, 4 * 3600);
    if ($maxOffset < 0) {
        $maxOffset = 0;
    }
    $offset = rand(0, $maxOffset);
    $later = $timestamp + $offset;
    return date('H:i:s', $later);
}

/**
 * Run Scenario 1: endTime is NULL → always returns true.
 */
function runNullEndTimeScenario(int $iterations): array
{
    $passed = 0;
    $failed = 0;
    $failures = [];

    for ($i = 0; $i < $iterations; $i++) {
        $currentTime = generateRandomTime();
        $endTime = null;

        $result = isTimeOutAllowed($currentTime, $endTime);

        if ($result !== true) {
            $failed++;
            $failures[] = [
                'iteration' => $i + 1,
                'scenario' => 'null_endTime',
                'currentTime' => $currentTime,
                'endTime' => 'NULL',
                'expected' => 'true',
                'actual' => var_export($result, true),
            ];
        } else {
            $passed++;
        }
    }

    return ['passed' => $passed, 'failed' => $failed, 'failures' => $failures];
}

/**
 * Run Scenario 2: currentTime < endTime → returns false.
 */
function runBeforeEndTimeScenario(int $iterations): array
{
    $passed = 0;
    $failed = 0;
    $failures = [];

    for ($i = 0; $i < $iterations; $i++) {
        // Generate endTime with enough room for a "before" time (at least 00:01:00)
        $endHours = rand(1, 23);
        $endMinutes = rand(1, 59);
        $endSeconds = rand(1, 59);
        $endTime = sprintf('%02d:%02d:%02d', $endHours, $endMinutes, $endSeconds);

        $currentTime = generateTimeBefore($endTime);

        $result = isTimeOutAllowed($currentTime, $endTime);

        if ($result !== false) {
            $failed++;
            $failures[] = [
                'iteration' => $i + 1,
                'scenario' => 'before_endTime',
                'currentTime' => $currentTime,
                'endTime' => $endTime,
                'expected' => 'false',
                'actual' => var_export($result, true),
            ];
        } else {
            $passed++;
        }
    }

    return ['passed' => $passed, 'failed' => $failed, 'failures' => $failures];
}

/**
 * Run Scenario 3: currentTime >= endTime → returns true.
 */
function runAtOrAfterEndTimeScenario(int $iterations): array
{
    $passed = 0;
    $failed = 0;
    $failures = [];

    for ($i = 0; $i < $iterations; $i++) {
        // Generate endTime with enough room for an "at or after" time
        $endHours = rand(0, 22);
        $endMinutes = rand(0, 58);
        $endSeconds = rand(0, 58);
        $endTime = sprintf('%02d:%02d:%02d', $endHours, $endMinutes, $endSeconds);

        $currentTime = generateTimeAtOrAfter($endTime);

        $result = isTimeOutAllowed($currentTime, $endTime);

        if ($result !== true) {
            $failed++;
            $failures[] = [
                'iteration' => $i + 1,
                'scenario' => 'at_or_after_endTime',
                'currentTime' => $currentTime,
                'endTime' => $endTime,
                'expected' => 'true',
                'actual' => var_export($result, true),
            ];
        } else {
            $passed++;
        }
    }

    return ['passed' => $passed, 'failed' => $failed, 'failures' => $failures];
}

// --- Execute Test ---

echo "==========================================================\n";
echo "Property Test: Time-Out Gate Correctness (Property 6)\n";
echo "Validates: Requirements 5.1, 5.4, 6.1, 8.1, 8.2, 8.3\n";
echo "==========================================================\n\n";
echo "Property: isTimeOutAllowed(currentTime, endTime) SHALL:\n";
echo "  - Return true  when endTime is NULL (no gate)\n";
echo "  - Return false when currentTime < endTime\n";
echo "  - Return true  when currentTime >= endTime\n\n";

$iterationsPerScenario = 50; // 50 x 3 scenarios = 150 total iterations
$totalIterations = $iterationsPerScenario * 3;

echo "Running $totalIterations randomized iterations ($iterationsPerScenario per scenario)...\n\n";

// Scenario 1: Null endTime
echo "--- Scenario 1: endTime is NULL → always true ---\n";
$scenario1 = runNullEndTimeScenario($iterationsPerScenario);
echo "  Results: {$scenario1['passed']}/$iterationsPerScenario passed, {$scenario1['failed']} failed\n\n";

// Scenario 2: currentTime < endTime
echo "--- Scenario 2: currentTime < endTime → false ---\n";
$scenario2 = runBeforeEndTimeScenario($iterationsPerScenario);
echo "  Results: {$scenario2['passed']}/$iterationsPerScenario passed, {$scenario2['failed']} failed\n\n";

// Scenario 3: currentTime >= endTime
echo "--- Scenario 3: currentTime >= endTime → true ---\n";
$scenario3 = runAtOrAfterEndTimeScenario($iterationsPerScenario);
echo "  Results: {$scenario3['passed']}/$iterationsPerScenario passed, {$scenario3['failed']} failed\n\n";

// Summary
$totalPassed = $scenario1['passed'] + $scenario2['passed'] + $scenario3['passed'];
$totalFailed = $scenario1['failed'] + $scenario2['failed'] + $scenario3['failed'];
$allFailures = array_merge($scenario1['failures'], $scenario2['failures'], $scenario3['failures']);

echo "==========================================================\n";
echo "TOTAL: $totalPassed/$totalIterations passed, $totalFailed failed\n";
echo "==========================================================\n\n";

if ($totalFailed > 0) {
    echo "FAILURES:\n";
    echo "-----------------------------------------------------------\n";
    foreach ($allFailures as $failure) {
        echo "  Iteration {$failure['iteration']} (Scenario: {$failure['scenario']}):\n";
        echo "    currentTime:  {$failure['currentTime']}\n";
        echo "    endTime:      {$failure['endTime']}\n";
        echo "    expected:     {$failure['expected']}\n";
        echo "    actual:       {$failure['actual']}\n";
        echo "\n";
    }
    echo "-----------------------------------------------------------\n";
    echo "FAIL — Property violated: isTimeOutAllowed returned unexpected value\n";
    exit(1);
} else {
    echo "PASS — Property holds: isTimeOutAllowed correctly implements Time-Out Gate logic\n";
    exit(0);
}
