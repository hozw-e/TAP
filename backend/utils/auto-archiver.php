<?php
/**
 * Auto-Archiver Utility
 *
 * Handles automatic archival of students whose remaining_sessions has reached 0.
 * This function is designed to be called WITHIN an existing transaction managed
 * by the caller — it does NOT begin/commit its own transaction.
 */

/**
 * Auto-archive a student whose remaining_sessions has reached 0.
 * Sets is_archived = 1 and logs an AUTO_ARCHIVE activity.
 *
 * @param PDO    $conn        Database connection (already in a transaction)
 * @param int    $studentId   Student ID to archive
 * @param string $studentName Student name (for activity log)
 * @return bool  True if archival succeeded, false on failure
 */
function autoArchiveStudent(PDO $conn, int $studentId, string $studentName): bool
{
    try {
        // 1. Set is_archived = 1 on the student record
        $archiveStmt = $conn->prepare(
            "UPDATE students SET is_archived = 1 WHERE student_id = :student_id"
        );
        $archiveStmt->execute([':student_id' => $studentId]);

        // 2. Insert activity_logs record with action_type AUTO_ARCHIVE
        $logStmt = $conn->prepare(
            "INSERT INTO activity_logs (timestamp, admin_name, action_type, entity_type, entity_name, details)
             VALUES (NOW(), :admin_name, :action_type, :entity_type, :entity_name, :details)"
        );
        $logStmt->execute([
            ':admin_name'  => 'System',
            ':action_type' => 'AUTO_ARCHIVE',
            ':entity_type' => 'STUDENT',
            ':entity_name' => $studentName,
            ':details'     => 'Auto-archived: student completed all 4 sessions',
        ]);

        return true;
    } catch (\Throwable $e) {
        error_log('Auto-Archiver Error: ' . $e->getMessage());
        return false;
    }
}
