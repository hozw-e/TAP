<?php
/**
 * Rate Limiting Utility
 *
 * Simple fixed-window, per-IP rate limiter backed by a database table.
 * Used to protect public/unauthenticated endpoints (e.g. the NFC scan
 * endpoint) from flooding.
 *
 * Usage:
 *   require_once '../../utils/rate-limit.php';
 *   enforceRateLimit($conn, 'nfc_scan', 60, 60); // 60 requests / 60s per IP
 *
 * On limit exceeded, responds with HTTP 429 and exits.
 */

require_once __DIR__ . '/response.php';

/**
 * Enforce a per-IP rate limit for a named bucket.
 *
 * Fails open: if the backing table can't be read/written (e.g. a transient DB
 * error), the request is allowed rather than blocking legitimate traffic.
 *
 * @param PDO    $conn          Active database connection.
 * @param string $bucket        Logical name for this limit (e.g. 'nfc_scan').
 * @param int    $maxRequests   Max allowed requests within the window.
 * @param int    $windowSeconds Window length in seconds.
 */
function enforceRateLimit($conn, $bucket, $maxRequests, $windowSeconds) {
    $clientIP = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

    try {
        // (rate_limit_hits table is provisioned by migration 010_rate_limit_hits.sql)
        // Prune old hits for this bucket so the table stays small.
        $prune = $conn->prepare("
            DELETE FROM rate_limit_hits
            WHERE bucket = :bucket
              AND hit_at < DATE_SUB(NOW(), INTERVAL :window SECOND)
        ");
        $prune->bindValue(':bucket', $bucket);
        $prune->bindValue(':window', (int)$windowSeconds, PDO::PARAM_INT);
        $prune->execute();

        // Count hits in the current window for this IP + bucket.
        $count = $conn->prepare("
            SELECT COUNT(*) AS hits
            FROM rate_limit_hits
            WHERE bucket = :bucket
              AND ip_address = :ip
              AND hit_at > DATE_SUB(NOW(), INTERVAL :window SECOND)
        ");
        $count->bindValue(':bucket', $bucket);
        $count->bindValue(':ip', $clientIP);
        $count->bindValue(':window', (int)$windowSeconds, PDO::PARAM_INT);
        $count->execute();
        $hits = (int)($count->fetch(PDO::FETCH_ASSOC)['hits'] ?? 0);

        if ($hits >= $maxRequests) {
            sendErrorResponse('Rate limit exceeded. Please slow down.', 429);
        }

        // Record this hit.
        $record = $conn->prepare("
            INSERT INTO rate_limit_hits (bucket, ip_address, hit_at)
            VALUES (:bucket, :ip, NOW())
        ");
        $record->bindValue(':bucket', $bucket);
        $record->bindValue(':ip', $clientIP);
        $record->execute();
    } catch (PDOException $e) {
        // Fail open — never let a rate-limiter DB hiccup take down the endpoint.
        error_log('enforceRateLimit error (' . $bucket . '): ' . $e->getMessage());
    }
}
?>
