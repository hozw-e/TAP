<?php
/**
 * JWT Token Utility
 * Simple JWT implementation for authentication
 */

class JWT {
    private static $secret_key = 'your-secret-key-change-this-in-production-2024';
    private static $algorithm = 'HS256';
    
    /**
     * Generate JWT token
     */
    public static function encode($payload) {
        $header = json_encode(['typ' => 'JWT', 'alg' => self::$algorithm]);
        $payload = json_encode($payload);
        
        $base64UrlHeader = self::base64UrlEncode($header);
        $base64UrlPayload = self::base64UrlEncode($payload);
        
        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, self::$secret_key, true);
        $base64UrlSignature = self::base64UrlEncode($signature);
        
        return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
    }
    
    /**
     * Decode and verify JWT token
     */
    public static function decode($jwt) {
        if (!$jwt) {
            return null;
        }
        
        $tokenParts = explode('.', $jwt);
        if (count($tokenParts) !== 3) {
            return null;
        }
        
        list($base64UrlHeader, $base64UrlPayload, $base64UrlSignature) = $tokenParts;
        
        // Verify signature
        $signature = self::base64UrlDecode($base64UrlSignature);
        $expectedSignature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, self::$secret_key, true);
        
        if (!hash_equals($signature, $expectedSignature)) {
            return null;
        }
        
        // Decode payload
        $payload = json_decode(self::base64UrlDecode($base64UrlPayload), true);
        
        // Check expiration
        if (isset($payload['exp']) && $payload['exp'] < time()) {
            return null;
        }
        
        return $payload;
    }
    
    /**
     * Get token from Authorization header
     */
    public static function getBearerToken() {
        $headers = getallheaders();
        
        if (isset($headers['Authorization'])) {
            $matches = [];
            if (preg_match('/Bearer\s+(.*)$/i', $headers['Authorization'], $matches)) {
                return $matches[1];
            }
        }
        
        return null;
    }
    
    private static function base64UrlEncode($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
    
    private static function base64UrlDecode($data) {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}

/**
 * Verify JWT token and return payload
 */
function verifyJWT() {
    $token = JWT::getBearerToken();
    if (!$token) {
        return null;
    }
    
    return JWT::decode($token);
}

/**
 * Require JWT authentication
 */
function requireJWTAuth() {
    $payload = verifyJWT();
    
    if (!$payload) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Unauthorized. Valid token required.'
        ]);
        exit;
    }
    
    return $payload;
}

/**
 * Check authentication (JWT or Session)
 * Supports both JWT tokens and legacy session authentication
 */
function requireAuth() {
    // Try JWT first
    $jwtPayload = verifyJWT();
    if ($jwtPayload) {
        return $jwtPayload;
    }
    
    // Fallback to session authentication
    require_once __DIR__ . '/session.php';
    if (isAdminLoggedIn()) {
        return [
            'admin_id' => $_SESSION['admin_id'] ?? null,
            'admin_name' => $_SESSION['admin_name'] ?? null,
            'username' => $_SESSION['username'] ?? null
        ];
    }
    
    // Neither JWT nor session is valid
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Unauthorized. Please login.'
    ]);
    exit;
}
?>
