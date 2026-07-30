<?php
require_once '../../config/database.php';

try {
    $conn = getDBConnection();
    $newPassword = 'admin123';
    $hash = password_hash($newPassword, PASSWORD_DEFAULT);
    
    echo "Generated hash: " . $hash . "<br><br>";
    
    $stmt = $conn->prepare("UPDATE admins SET password = :password WHERE username = :username");
    $stmt->execute([
        ':password' => $hash,
        ':username' => 'admin1'
    ]);
    
    $rowCount = $stmt->rowCount();
    echo "Rows updated: " . $rowCount . "<br>";
    
    if ($rowCount > 0) {
        echo "<br><strong>Password reset successful!</strong><br>";
        echo "Username: admin1<br>";
        echo "Password: admin123<br><br>";
        echo "<strong style='color:red'>DELETE THIS FILE IMMEDIATELY after use.</strong>";
    } else {
        echo "<br><strong>No rows updated.</strong> Check if username 'admin1' exists.";
    }
    
    // Verify it works
    $stmt2 = $conn->prepare("SELECT password FROM admins WHERE username = :username");
    $stmt2->execute([':username' => 'admin1']);
    $row = $stmt2->fetch(PDO::FETCH_ASSOC);
    
    echo "<br><br>Verification: ";
    if (password_verify('admin123', $row['password'])) {
        echo "<span style='color:green'>password_verify PASSES ✓</span>";
    } else {
        echo "<span style='color:red'>password_verify FAILS ✗</span>";
    }
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
