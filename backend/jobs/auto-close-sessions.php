<?php
/**
 * Auto-close open sessions job
 * 
 * Students: Run via cron at 00:00 (midnight) — closes yesterday's open attendance sessions.
 * Visitors: Run via cron at 17:00 (5 PM) — closes today's open visitor sessions.
 *
 * Usage:
 *   php auto-close-sessions.php students   (run at midnight)
 *   php auto-close-sessions.php visitors   (run at 5 PM)
 *   php auto-close-sessions.php            (runs both — students for yesterday, visitors for today)
 */

date_default_timezone_set('Asia/Manila');
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../utils/session-counter.php';
require_once __DIR__ . '/../utils/auto-archiver.php';

// ============================================================
// Main execution
// ============================================================

$conn = getDBConnection();
if (!$conn) {
    error_log('auto-close-sessions.php: Failed to connect to database');
    echo "Auto-close sessions job FAILED: database connection error\n";
    exit(1);
}

$mode = $argv[1] ?? 'all'; // 'students', 'visitors', or 'all'

$studentsClosed = 0;
$visitorsClosed = 0;
$tagsReleased = 0;

try {
    // ─── Students: close yesterday's open sessions at 23:59:59 ─────────────────
    if ($mode === 'students' || $mode === 'all') {
        $yesterday = date('Y-m-d', strtotime('-1 day'));

        // Select all open student attendance records for yesterday
        $selectStmt = $conn->prepare("
            SELECT a.attendance_id, a.student_id, s.student_name
            FROM attendance_logs a
            JOIN students s ON a.student_id = s.student_id
            WHERE a.date = :date
              AND a.time_in IS NOT NULL
              AND a.time_out IS NULL
        ");
        $selectStmt->execute([':date' => $yesterday]);
        $openRecords = $selectStmt->fetchAll(PDO::FETCH_ASSOC);

        // Process each record individually with session decrement
        foreach ($openRecords as $record) {
            try {
                $conn->beginTransaction();

                // Set time_out to 23:59:59 and mark as auto_closed
                $updateStmt = $conn->prepare("
                    UPDATE attendance_logs
                    SET time_out = :time_out,
                        auto_closed = 1
                    WHERE attendance_id = :id
                ");
                $updateStmt->execute([
                    ':time_out' => '23:59:59',
                    ':id'       => $record['attendance_id'],
                ]);

                // Decrement session (idempotent via session_decremented flag)
                $remainingSessions = decrementSession(
                    $conn,
                    (int) $record['student_id'],
                    (int) $record['attendance_id']
                );

                // Auto-archive if sessions exhausted
                if ($remainingSessions === 0) {
                    autoArchiveStudent(
                        $conn,
                        (int) $record['student_id'],
                        $record['student_name']
                    );
                }

                $conn->commit();
                $studentsClosed++;
            } catch (\Throwable $e) {
                if ($conn->inTransaction()) {
                    $conn->rollBack();
                }
                error_log(
                    "auto-close-sessions.php: Failed to process attendance_id={$record['attendance_id']} "
                    . "student_id={$record['student_id']}: " . $e->getMessage()
                );
                // Continue to next record
            }
        }

        echo "Students ({$yesterday}): {$studentsClosed} session(s) auto-closed at 23:59:59\n";
    }

    // ─── Visitors: close today's open sessions at 17:00:00 ─────────────────────
    if ($mode === 'visitors' || $mode === 'all') {
        $today = date('Y-m-d');

        $stmt = $conn->prepare("
            UPDATE visitors
            SET time_out = :time_out
            WHERE date_of_visit = :date
              AND time_in IS NOT NULL
              AND time_out IS NULL
        ");
        $stmt->execute([
            ':time_out' => '17:00:00',
            ':date'     => $today,
        ]);
        $visitorsClosed = $stmt->rowCount();

        // Release NFC tags linked to those now-closed visitor sessions
        $stmt = $conn->prepare("
            UPDATE nfc_tags
            SET visitor_session_id = NULL
            WHERE visitor_session_id IN (
                SELECT visit_id FROM visitors
                WHERE date_of_visit = :date
                  AND time_out IS NOT NULL
            )
        ");
        $stmt->execute([':date' => $today]);
        $tagsReleased = $stmt->rowCount();

        echo "Visitors ({$today}): {$visitorsClosed} session(s) auto-closed at 17:00:00, {$tagsReleased} NFC tag(s) released\n";
    }

} catch (PDOException $e) {
    error_log('auto-close-sessions.php: Query failed: ' . $e->getMessage());
    echo "Auto-close sessions job FAILED: " . $e->getMessage() . "\n";
    exit(1);
}

echo "Done.\n";
