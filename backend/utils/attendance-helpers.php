<?php
/**
 * Attendance flag computation helpers.
 * All functions are PURE — no DB access, no side effects.
 * All time comparisons use strtotime() for HH:MM:SS comparison.
 */

/**
 * Determine if a check-in time falls within the allowed time-in window.
 *
 * Rules:
 * - Return 'too_early' if checkInTime < startTime - 60 minutes
 * - Return 'session_ended' if endTime is non-null and checkInTime >= endTime
 * - Otherwise return 'allowed'
 *
 * @param string      $checkInTime Current time (HH:MM:SS)
 * @param string      $startTime   Session start time (HH:MM:SS)
 * @param string|null $endTime     Session end time (HH:MM:SS) or null
 * @return string 'allowed'|'too_early'|'session_ended'
 */
function validateTimeInWindow(string $checkInTime, string $startTime, ?string $endTime): string
{
    $checkIn = strtotime($checkInTime);
    $start = strtotime($startTime);

    // Too early: more than 60 minutes before start time
    $earliestAllowed = $start - (60 * 60);
    if ($checkIn < $earliestAllowed) {
        return 'too_early';
    }

    // Session ended: at or after end time (only when end time is defined)
    if ($endTime !== null) {
        $end = strtotime($endTime);
        if ($checkIn >= $end) {
            return 'session_ended';
        }
    }

    return 'allowed';
}

/**
 * Compute the attendance flag based on check-in time vs schedule.
 *
 * Rules:
 * - Return 'present' if checkInTime <= startTime
 * - Return 'tardy' if gracePeriod > 0 and checkInTime <= startTime + gracePeriod
 * - If endTime is NULL, never return 'late' (return 'tardy' instead)
 * - Otherwise return 'late'
 *
 * @param string      $checkInTime Current time (HH:MM:SS)
 * @param string      $startTime   Session start time (HH:MM:SS)
 * @param int         $gracePeriod Grace period in minutes (0-120)
 * @param string|null $endTime     Session end time (HH:MM:SS) or null
 * @return string 'present'|'tardy'|'late'
 */
function computeAttendanceFlag(string $checkInTime, string $startTime, int $gracePeriod, ?string $endTime): string
{
    $checkIn = strtotime($checkInTime);
    $start = strtotime($startTime);

    // On time or early: present
    if ($checkIn <= $start) {
        return 'present';
    }

    // Within grace period: tardy
    if ($gracePeriod > 0) {
        $deadline = $start + ($gracePeriod * 60);
        if ($checkIn <= $deadline) {
            return 'tardy';
        }
    }

    // If endTime is NULL, never return 'late' — fall back to 'tardy'
    // BUT when gracePeriod is 0, tardy is forbidden (Req 2.3: zero grace = never tardy)
    // In that edge case, return 'late' since Req 2.3 is unconditional
    if ($endTime === null) {
        return $gracePeriod > 0 ? 'tardy' : 'late';
    }

    return 'late';
}

/**
 * Determine if a time-out attempt should be allowed based on session end time.
 *
 * Rules:
 * - Return true if endTime is NULL (no gate enforced)
 * - Return true if currentTime >= endTime
 * - Otherwise return false
 *
 * @param string      $currentTime Current time (HH:MM:SS)
 * @param string|null $endTime     Session end time (HH:MM:SS) or null (null = always allow)
 * @return bool true if time-out is allowed
 */
function isTimeOutAllowed(string $currentTime, ?string $endTime): bool
{
    if ($endTime === null) {
        return true;
    }

    $current = strtotime($currentTime);
    $end = strtotime($endTime);

    return $current >= $end;
}

/**
 * Validate total_hours value.
 *
 * Rules:
 * - Accept NULL as valid (no enforcement) → {valid: true, error: null, value: null}
 * - Accept numeric values in [1.0, 200.0] → {valid: true, error: null, value: float}
 * - Reject non-numeric values with error message
 * - Reject values outside [1.0, 200.0] with error message
 *
 * @param mixed $value The value to validate
 * @return array{valid: bool, error: string|null, value: float|null}
 */
function validateTotalHours($value): array
{
    // NULL means no enforcement — valid
    if ($value === null) {
        return ['valid' => true, 'error' => null, 'value' => null];
    }

    // Reject non-numeric values
    if (!is_numeric($value)) {
        return ['valid' => false, 'error' => 'total_hours must be a numeric value between 1.0 and 200.0', 'value' => null];
    }

    $floatValue = (float) $value;

    // Reject values outside allowed range
    if ($floatValue < 1.0 || $floatValue > 200.0) {
        return ['valid' => false, 'error' => 'total_hours must be between 1.0 and 200.0', 'value' => null];
    }

    return ['valid' => true, 'error' => null, 'value' => $floatValue];
}

/**
 * Compute end_time from start_time and total_hours.
 *
 * Adds (totalHours / 4) hours to the start time to derive the session end time.
 *
 * @param string $startTime   Session start time (HH:MM:SS or HH:MM)
 * @param float  $totalHours  Total hours for the course
 * @return string Computed end_time (HH:MM:SS)
 */
function computeEndTimeFromTotalHours(string $startTime, float $totalHours): string
{
    $start = strtotime($startTime);
    $sessionHours = $totalHours / 4;
    $sessionSeconds = (int) round($sessionHours * 3600);
    $end = $start + $sessionSeconds;

    return date('H:i:s', $end);
}

/**
 * Format remaining time until session end as human-readable string.
 *
 * Computes the difference in seconds between endTime and currentTime,
 * then formats as "X minutes Y seconds".
 *
 * @param string $currentTime Current time (HH:MM:SS)
 * @param string $endTime     Session end time (HH:MM:SS)
 * @return string e.g. "12 minutes 30 seconds"
 */
function formatRemainingTime(string $currentTime, string $endTime): string
{
    $current = strtotime($currentTime);
    $end = strtotime($endTime);

    $diffSeconds = $end - $current;

    if ($diffSeconds <= 0) {
        return "0 minutes 0 seconds";
    }

    $minutes = intdiv($diffSeconds, 60);
    $seconds = $diffSeconds % 60;

    return "{$minutes} minutes {$seconds} seconds";
}

/**
 * Determine if a check-out attempt meets the minimum session duration requirement.
 *
 * Rules:
 * - Skip enforcement (allow) when totalHours is NULL
 * - Skip enforcement (allow) when endTime is not NULL and currentTime >= endTime (end-time cap)
 * - Compute rendered_minutes = floor((currentTime - timeIn) in minutes)
 * - Compute minimum_minutes = floor(totalHours * 60 / 4)
 * - Deny if rendered_minutes < minimum_minutes
 * - Edge: unparseable timeIn → allow + log warning
 * - Edge: negative duration → treat as 0 minutes, deny
 *
 * @param string      $timeIn        Student's check-in time (HH:MM:SS)
 * @param string      $currentTime   Current server time (HH:MM:SS)
 * @param float|null  $totalHours    Course total_hours (NULL = no enforcement)
 * @param string|null $endTime       Session end_time (NULL = no cap)
 * @return array{allowed: bool, rendered_minutes: int, minimum_minutes: int, remaining_minutes: int}
 */
function checkHourRequirement(string $timeIn, string $currentTime, ?float $totalHours, ?string $endTime): array
{
    // Skip enforcement when totalHours is NULL (no hour requirement configured)
    if ($totalHours === null) {
        return [
            'allowed' => true,
            'rendered_minutes' => 0,
            'minimum_minutes' => 0,
            'remaining_minutes' => 0,
        ];
    }

    // Compute minimum_minutes from totalHours
    $minimum_minutes = (int) floor($totalHours * 60 / 4);

    // Skip enforcement (allow) when endTime is not NULL and currentTime >= endTime (end-time cap override)
    if ($endTime !== null) {
        $currentTs = strtotime($currentTime);
        $endTs = strtotime($endTime);
        if ($currentTs !== false && $endTs !== false && $currentTs >= $endTs) {
            // Compute rendered_minutes for informational purposes even when allowing via cap
            $timeInTs = strtotime($timeIn);
            $rendered_minutes = 0;
            if ($timeInTs !== false && $currentTs !== false) {
                $diffSeconds = $currentTs - $timeInTs;
                $rendered_minutes = ($diffSeconds < 0) ? 0 : (int) floor($diffSeconds / 60);
            }
            return [
                'allowed' => true,
                'rendered_minutes' => $rendered_minutes,
                'minimum_minutes' => $minimum_minutes,
                'remaining_minutes' => max(0, $minimum_minutes - $rendered_minutes),
            ];
        }
    }

    // Parse timeIn — if unparseable, skip enforcement and log warning
    $timeInTs = strtotime($timeIn);
    if ($timeInTs === false) {
        error_log("checkHourRequirement: Unable to parse timeIn '{$timeIn}'. Skipping hour enforcement.");
        return [
            'allowed' => true,
            'rendered_minutes' => 0,
            'minimum_minutes' => $minimum_minutes,
            'remaining_minutes' => 0,
        ];
    }

    // Compute rendered duration in seconds
    $currentTs = strtotime($currentTime);
    $diffSeconds = $currentTs - $timeInTs;

    // Edge case: negative duration (timeIn is later than currentTime)
    if ($diffSeconds < 0) {
        error_log("checkHourRequirement: Negative duration detected (timeIn='{$timeIn}', currentTime='{$currentTime}'). Possible clock or data inconsistency.");
        $rendered_minutes = 0;
    } else {
        $rendered_minutes = (int) floor($diffSeconds / 60);
    }

    // Compute remaining
    $remaining_minutes = max(0, $minimum_minutes - $rendered_minutes);

    // Determine if allowed
    $allowed = $rendered_minutes >= $minimum_minutes;

    return [
        'allowed' => $allowed,
        'rendered_minutes' => $rendered_minutes,
        'minimum_minutes' => $minimum_minutes,
        'remaining_minutes' => $remaining_minutes,
    ];
}
