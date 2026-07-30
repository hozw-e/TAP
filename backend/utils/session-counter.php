<?php
/**
 * Session counter utility functions.
 * Handles decrementing remaining_sessions and idempotency checks
 * for session-based enrollment tracking.
 *
 * NOTE: These functions do NOT manage transactions — the caller
 * (e.g. scan.php) is responsible for wrapping calls in a transaction.
 */

/**
 * Check if a session has already been decremented for an attendance record.
 *
 * @param PDO $conn         Database connection (must be within an active transaction)
 * @param int $attendanceId Attendance record ID
 * @return bool True if already decremented
 * @throws RuntimeException If the query fails or the record does not exist
 */
function isSessionDecremented(PDO $conn, int $attendanceId): bool
{
    $stmt = $conn->prepare(
        'SELECT session_decremented FROM attendance_logs WHERE attendance_id = :id'
    );
    $stmt->execute([':id' => $attendanceId]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row === false) {
        throw new RuntimeException(
            "Attendance record not found: attendance_id={$attendanceId}"
        );
    }

    return (bool) $row['session_decremented'];
}

/**
 * Decrement a student's remaining sessions after a valid check-out.
 *
 * This function:
 * 1. Checks the idempotency flag — returns early if already decremented
 * 2. Locks the student row with SELECT ... FOR UPDATE for concurrency safety
 * 3. Decrements remaining_sessions only if > 0
 * 4. Marks the attendance record's session_decremented = TRUE
 * 5. Returns the new remaining_sessions value
 *
 * @param PDO $conn         Database connection (must be within an active transaction)
 * @param int $studentId    Student ID
 * @param int $attendanceId Attendance record that triggered the decrement
 * @return int New remaining_sessions value (0-4)
 * @throws RuntimeException If decrement fails or student not found
 */
function decrementSession(PDO $conn, int $studentId, int $attendanceId): int
{
    // Step 1: Idempotency guard — skip if already decremented
    if (isSessionDecremented($conn, $attendanceId)) {
        // Already decremented — return current value without modifying
        $stmt = $conn->prepare(
            'SELECT remaining_sessions FROM students WHERE student_id = :sid'
        );
        $stmt->execute([':sid' => $studentId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($row === false) {
            throw new RuntimeException(
                "Student not found: student_id={$studentId}"
            );
        }

        return (int) $row['remaining_sessions'];
    }

    // Step 2: Lock the student row for concurrency safety
    $stmt = $conn->prepare(
        'SELECT remaining_sessions FROM students WHERE student_id = :sid FOR UPDATE'
    );
    $stmt->execute([':sid' => $studentId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row === false) {
        throw new RuntimeException(
            "Student not found: student_id={$studentId}"
        );
    }

    $currentSessions = (int) $row['remaining_sessions'];

    // Step 3: Only decrement if remaining_sessions > 0
    if ($currentSessions > 0) {
        $updateStmt = $conn->prepare(
            'UPDATE students SET remaining_sessions = remaining_sessions - 1 WHERE student_id = :sid AND remaining_sessions > 0'
        );
        $result = $updateStmt->execute([':sid' => $studentId]);

        if (!$result) {
            throw new RuntimeException(
                "Failed to decrement remaining_sessions for student_id={$studentId}"
            );
        }

        $currentSessions -= 1;
    }

    // Step 4: Mark attendance record as decremented
    $flagStmt = $conn->prepare(
        'UPDATE attendance_logs SET session_decremented = TRUE WHERE attendance_id = :id'
    );
    $flagResult = $flagStmt->execute([':id' => $attendanceId]);

    if (!$flagResult) {
        throw new RuntimeException(
            "Failed to set session_decremented flag for attendance_id={$attendanceId}"
        );
    }

    // Step 5: Return the new remaining_sessions value
    return $currentSessions;
}
