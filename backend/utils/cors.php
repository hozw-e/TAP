<?php
// With the consolidated single-origin deployment the SPA and API share a
// domain, so most requests are same-origin and need no CORS header at all.
// We still echo back a known origin when one is present (e.g. the old split
// frontend, or local dev) so nothing breaks during migration. Extra origins
// can be supplied via the CORS_ALLOWED_ORIGINS env var (comma-separated).
$allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://apsolutionstap.up.railway.app',
    'https://thesisi-production.up.railway.app',
];

$envOrigins = getenv('CORS_ALLOWED_ORIGINS');
if ($envOrigins) {
    foreach (explode(',', $envOrigins) as $o) {
        $o = trim($o);
        if ($o !== '') {
            $allowedOrigins[] = $o;
        }
    }
}

$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';

if (in_array($origin, $allowedOrigins, true)) {
    header("Access-Control-Allow-Origin: $origin");
} 

header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type, X-CSRF-Token");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
?>