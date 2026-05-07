<?php
require_once __DIR__ . '/../config/database.php';

/**
 * Log an activity to the activity_logs table
 * 
 * @param string $actionType - Type of action (e.g., 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'NFC_ASSIGN', 'EXPORT')
 * @param string $entityType - Type of entity affected (e.g., 'STUDENT', 'GUARDIAN', 'ADMIN')
 * @param string $entityName - Name of the entity (e.g., student name, guardian name)
 * @param string $details - Additional details about the action
 * @param string $adminName - Name of the admin performing the action (optional, will use session if not provided)
 */
function logActivity($actionType, $entityType, $entityName, $details = '', $adminName = null) {
    try {
        $conn = getDBConnection();
        if (!$conn) {
            error_log("Activity Logger: Database connection failed");
            return false;
        }

        // Get admin name from session if not provided
        if ($adminName === null) {
            session_start();
            $adminName = isset($_SESSION['admin_name']) ? $_SESSION['admin_name'] : 'Unknown';
        }

        $timestamp = date('Y-m-d H:i:s');

        $query = "INSERT INTO activity_logs (timestamp, admin_name, action_type, entity_type, entity_name, details) 
                  VALUES (?, ?, ?, ?, ?, ?)";
        
        $stmt = $conn->prepare($query);
        $result = $stmt->execute([
            $timestamp,
            $adminName,
            $actionType,
            $entityType,
            $entityName,
            $details
        ]);

        return $result;
    } catch (Exception $e) {
        error_log("Activity Logger Error: " . $e->getMessage());
        return false;
    }
}
?>
