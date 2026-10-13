<?php
/**
 * Session Utility Functions
 */

// Configure session for cross-domain use
if (session_status() === PHP_SESSION_NONE) {
    // Detect if running over HTTPS
    $isSecure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
             || (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
             || (!empty($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443);

    ini_set('session.cookie_samesite', $isSecure ? 'None' : 'Lax');
    ini_set('session.cookie_secure', $isSecure ? '1' : '0');
    ini_set('session.cookie_httponly', '1');
    session_start();
}

function isAdminLoggedIn() {
    return isset($_SESSION['admin_id']) 
        && isset($_SESSION['admin_logged_in']) 
        && $_SESSION['admin_logged_in'] === true;
}

function requireAdminAuth() {
    // ✅ isAdminLoggedIn() now handles session start internally
    if (!isAdminLoggedIn()) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Unauthorized. Admin must be logged in.'
        ]);
        exit();
    }
}

/**
 * Return the CSRF token for the current session, generating one if absent.
 *
 * The token is a 64-char hex string stored server-side in the session. It is
 * handed to the client at login / session-check and must be echoed back in the
 * X-CSRF-Token header on every state-changing (POST/PUT/DELETE) request.
 */
function getCsrfToken() {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

/**
 * Enforce CSRF protection on state-changing requests.
 *
 * Safe methods (GET/HEAD/OPTIONS) are exempt. For POST/PUT/DELETE, the request
 * must carry an X-CSRF-Token header whose value matches the session token.
 * Uses hash_equals() to avoid timing attacks. Call this AFTER requireAdminAuth()
 * so unauthenticated callers get a 401 first.
 */
function requireCsrfToken() {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
        return; // Safe methods are not state-changing.
    }

    $sessionToken = $_SESSION['csrf_token'] ?? '';

    // Header names are normalized by PHP to HTTP_X_CSRF_TOKEN.
    $headerToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';

    if (empty($sessionToken) || empty($headerToken) || !hash_equals($sessionToken, $headerToken)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid or missing CSRF token.'
        ]);
        exit();
    }
}

/**
 * Get current admin info
 */
function getAdminInfo() {
    return [
        'admin_id'   => $_SESSION['admin_id']   ?? null,
        'admin_name' => $_SESSION['admin_name'] ?? null,
        'username'   => $_SESSION['username']   ?? null
    ];
}
 
/**
 * Set admin session
 */
function setAdminSession($adminData) {
    session_regenerate_id(true);

    $_SESSION['admin_logged_in'] = true;
    $_SESSION['admin_id']        = $adminData['admin_id'];
    $_SESSION['admin_name']      = $adminData['admin_name'];
    $_SESSION['username']        = $adminData['username'];
}
 
/**
 * Clear admin session
 */
function clearAdminSession() {
    // Best-effort: revoke any WebSocket tokens tied to this admin before destroying the session.
    if (isset($_SESSION['admin_id']) && function_exists('revokeWsTokensForAdmin')) {
        revokeWsTokensForAdmin((int)$_SESSION['admin_id']);
    }

    session_unset();
    session_destroy();
    session_start();
    session_regenerate_id(true);
}

/* ============================================================
 * WebSocket authentication tokens
 *
 * The WebSocket server must authenticate browser connections, but we do NOT
 * want to hand the raw PHP session ID to JavaScript or put it in a URL.
 * Instead we mint a dedicated, opaque, expiring token bound to the admin,
 * stored server-side in ws_tokens. The token is what travels to the WS server;
 * the PHP session ID never leaves the HttpOnly cookie.
 * ============================================================ */

/**
 * Issue a fresh WebSocket token for the currently logged-in admin.
 * (ws_tokens table is provisioned by migration 008_ws_tokens.sql)
 *
 * @param PDO $conn       Active DB connection.
 * @param int $ttlSeconds Lifetime of the token (default 2 hours).
 * @return array{token:string, expires_at:string}
 */
function issueWsToken($conn, $ttlSeconds = 7200) {
    // Opportunistically prune expired tokens so the table stays small.
    $conn->exec("DELETE FROM ws_tokens WHERE expires_at < NOW()");

    $token     = bin2hex(random_bytes(32)); // 64 hex chars
    $adminId   = (int)($_SESSION['admin_id'] ?? 0);
    $adminName = $_SESSION['admin_name'] ?? null;
    $expiresAt = date('Y-m-d H:i:s', time() + $ttlSeconds);

    $stmt = $conn->prepare("
        INSERT INTO ws_tokens (token, admin_id, admin_name, expires_at)
        VALUES (:token, :admin_id, :admin_name, :expires_at)
    ");
    $stmt->execute([
        ':token'      => $token,
        ':admin_id'   => $adminId,
        ':admin_name' => $adminName,
        ':expires_at' => $expiresAt,
    ]);

    return ['token' => $token, 'expires_at' => $expiresAt];
}

/**
 * Validate a WebSocket token. Returns admin info if the token exists and
 * has not expired, otherwise null. Does NOT touch the PHP session.
 *
 * @param PDO    $conn  Active DB connection.
 * @param string $token The opaque WS token presented by the client.
 * @return array{admin_id:int, admin_name:?string}|null
 */
function validateWsToken($conn, $token) {
    if (!preg_match('/^[a-f0-9]{64}$/', (string)$token)) {
        return null;
    }

    $stmt = $conn->prepare("
        SELECT admin_id, admin_name
        FROM ws_tokens
        WHERE token = :token AND expires_at > NOW()
        LIMIT 1
    ");
    $stmt->execute([':token' => $token]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        return null;
    }

    return [
        'admin_id'   => (int)$row['admin_id'],
        'admin_name' => $row['admin_name'],
    ];
}

/**
 * Revoke all WebSocket tokens for an admin (called on logout).
 */
function revokeWsTokensForAdmin($adminId) {
    $conn = getDBConnection();
    if (!$conn) {
        return;
    }
    try {
        $stmt = $conn->prepare("DELETE FROM ws_tokens WHERE admin_id = :admin_id");
        $stmt->execute([':admin_id' => (int)$adminId]);
    } catch (PDOException $e) {
        error_log('revokeWsTokensForAdmin failed: ' . $e->getMessage());
    }
}

?>