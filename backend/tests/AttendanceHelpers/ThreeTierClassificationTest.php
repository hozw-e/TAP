<?php
/**
 * Property Test: Three-Tier Classification Correctness
 * 
 * Validates: Requirements 1.1, 2.1, 3.1
 * 
 * Property 1: Three-Tier Classification Correctness
 * For any valid check-in time, start time, grace period (0-120), and non-null end time
 * where the check-in time is within the allowed window:
 * - checkInTime <= startTime → 'present'
 * - startTime < checkInTime <= startTime + gracePeriod → 'tardy'
 * - startTime + gracePeriod < checkInTime < endTime → 'late'
 *
 * Uses randomized data with 150 iterations (standalone, no PHPUnit required).
 * Run with: php backend/tests/AttendanceHelpers/ThreeTierClassificationTest.php
 */

require_once __DIR__ . '/../../utils/attendance-helpers.php';

/**
 * Generate a random HH:MM:SS time string within given bounds (seconds from midnight).
 */
function randomTimeInRange(int $minSeconds, int $maxSeconds): string
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
 * Generate a valid test case for Three-Tier Classification.
 * Ensures: start < end, gracePeriod is 0-120, and checkIn is within the allowed window.
 */
function generateTestCase(): array
{
    // Generate startTime between 06:00:00 and 20:00:00 (reasonable class hours)
    $startSec = rand(6 * 3600, 20 * 3600);
    
    // Generate gracePeriod between 1 and 120 minutes (must be > 0 for tardy zone to exist)
    $gracePeriod = rand(1, 120);
    
    // endTime must be after startTime + gracePeriod, with at least 1 second gap for 'late' zone
    $minEndSec = $startSec + ($gracePeriod * 60) + 1;
    // Cap at 23:59:59
    $maxEndSec = min(23 * 3600 + 59 * 60 + 59, $startSec + 4 * 3600);
    
    // If minEnd exceeds maxEnd, clamp to a valid range
    if ($minEndSec > $maxEndSec) {
        $maxEndSec = 23 * 3600 + 59 * 60 + 59;
    }
    if ($minEndSec > $maxEndSec) {
        // Fallback: use fixed values
        $startSec = 8 * 3600;
        $gracePeriod = 15;
        $minEndSec = $startSec + ($gracePeriod * 60) + 1;
        $maxEndSec = 12 * 3600;
    }
    
    $endSec = rand($minEndSec, $maxEndSec);
    
    // checkInTime is within the allowed window: between (startTime - 60min) and endTime - 1 second
    $earliestCheckIn = max(0, $startSec - 3600);
    $latestCheckIn = $endSec - 1;
    $checkInSec = rand($earliestCheckIn, $latestCheckIn);
    
    return [
        'startTime' => randomTimeFromSeconds($startSec),
        'endTime' => randomTimeFromSeconds($endSec),
        'gracePeriod' => $gracePeriod,
        'checkInTime' => randomTimeFromSeconds($checkInSec),
        'startSec' => $startSec,
        'endSec' => $endSec,
        'checkInSec' => $checkInSec,
    ];
}

/**
 * Convert seconds from midnight to HH:MM:SS.
 */
function randomTimeFromSeconds(int $seconds): string
{
    $h = intdiv($seconds, 3600);
    $m = intdiv($seconds % 3600, 60);
    $s = $seconds % 60;
    return sprintf('%02d:%02d:%02d', $h, $m, $s);
}

/**
 * Determine the expected classification based on raw second values.
 */
function expectedFlag(int $checkInSec, int $startSec, int $gracePeriod, int $endSec): string
{
    if ($checkInSec <= $startSec) {
        return 'present';
    }
    $graceDeadline = $startSec + ($gracePeriod * 60);
    if ($checkInSec <= $graceDeadline) {
        return 'tardy';
    }
    return 'late';
}

// ============================================================
// Run the property test
// ============================================================

$iterations = 150;
$passed = 0;
$failed = 0;
$failures = [];

echo "=== Property Test: Three-Tier Classification Correctness ===\n";
echo "Validates: Requirements 1.1, 2.1, 3.1\n";
echo "Running {$iterations} randomized iterations...\n\n";

for ($i = 0; $i < $iterations; $i++) {
    $case = generateTestCase();
    
    $expected = expectedFlag(
        $case['checkInSec'],
        $case['startSec'],
        $case['gracePeriod'],
        $case['endSec']
    );
    
    $actual = computeAttendanceFlag(
        $case['checkInTime'],
        $case['startTime'],
        $case['gracePeriod'],
        $case['endTime']
    );
    
    if ($actual === $expected) {
        $passed++;
    } else {
        $failed++;
        $failures[] = [
            'iteration' => $i + 1,
            'checkInTime' => $case['checkInTime'],
            'startTime' => $case['startTime'],
            'endTime' => $case['endTime'],
            'gracePeriod' => $case['gracePeriod'],
            'expected' => $expected,
            'actual' => $actual,
        ];
    }
}

// ============================================================
// Report results
// ============================================================

echo "Results: {$passed} passed, {$failed} failed out of {$iterations} iterations.\n\n";

if ($failed > 0) {
    echo "FAILURES:\n";
    echo str_repeat('-', 70) . "\n";
    foreach ($failures as $f) {
        echo "  Iteration #{$f['iteration']}:\n";
        echo "    checkInTime:  {$f['checkInTime']}\n";
        echo "    startTime:    {$f['startTime']}\n";
        echo "    endTime:      {$f['endTime']}\n";
        echo "    gracePeriod:  {$f['gracePeriod']} minutes\n";
        echo "    Expected:     {$f['expected']}\n";
        echo "    Actual:       {$f['actual']}\n\n";
    }
    echo str_repeat('-', 70) . "\n";
    echo "\nFAILED - Property does not hold.\n";
    exit(1);
} else {
    echo "PASSED - Three-Tier Classification property holds across all {$iterations} iterations.\n";
    exit(0);
}
