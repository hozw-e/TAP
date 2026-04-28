<?php
/**
 * One-time script to hash existing plaintext admin passwords
 * Run once, then DELETE this file immediately after
 * Access: https://your-backend-domain.up.railway.app/hash-passwords.php
 */

require_once 'config/database.php';

$conn = getDBConnection();
if (!$conn) {
    die('Database connection failed');
}

// Fetch all admins with plaintext passwords
$stmt = $conn->query("SELECT admin_id, username, password FROM admins");
$admins = $stmt->fetchAll(PDO::FETCH_ASSOC);

$updated = 0;

foreach ($admins as $admin) {
    // Skip already hashed passwords (they start with $2y$)
    if (strpos($admin['password'], '$2y$') === 0) {
        echo "Skipping {$admin['username']} — already hashed<br>";
        continue;
    }

    $hashed = password_hash($admin['password'], PASSWORD_BCRYPT);

    $update = $conn->prepare("UPDATE admins SET password = :password WHERE admin_id = :id");
    $update->execute([
        ':password' => $hashed,
        ':id'       => $admin['admin_id'],
    ]);

    echo "✅ Hashed password for: {$admin['username']}<br>";
    $updated++;
}

echo "<br><strong>Done! $updated password(s) hashed.</strong>";
echo "<br><br><strong style='color:red'>⚠️ DELETE this file now!</strong>";
?>