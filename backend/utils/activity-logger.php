<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/session.php';

/**
 * Log an activity to the activity_logs table
 *
 * @param string      $actionType Type of action (CREATE, UPDATE, DELETE, LOGIN, LOGOUT, NFC_ASSIGN, EXPORT, ...)
 * @param string      $entityType Type of entity affected (STUDENT, GUARDIAN, ADMIN, ...)
 * @param string      $entityName Name of the entity
 * @param string      $details    Additional details about the action
 * @param string|null $adminName  Optional override. Falls back to the current admin session.
 * @return bool
 */
function logActivity($actionType, $entityType, $entityName, $details = '', $adminName = null) {
    try {
        $conn = getDBConnection();
        if (!$conn) {
            error_log('Activity Logger: Database connection failed');
            return false;
        }

        // Resolve admin name from the session if caller didn't pass one.
        // session.php already starts the session, so we just read from it.
        if ($adminName === null) {
            $adminName = $_SESSION['admin_name'] ?? 'System';
        }

        $query = "INSERT INTO activity_logs (timestamp, admin_name, action_type, entity_type, entity_name, details)
                  VALUES (NOW(), :admin_name, :action_type, :entity_type, :entity_name, :details)";

        $stmt = $conn->prepare($query);
        return $stmt->execute([
            ':admin_name'  => $adminName,
            ':action_type' => $actionType,
            ':entity_type' => $entityType,
            ':entity_name' => $entityName,
            ':details'     => $details,
        ]);
    } catch (Exception $e) {
        error_log('Activity Logger Error: ' . $e->getMessage());
        return false;
    }
}
?>
