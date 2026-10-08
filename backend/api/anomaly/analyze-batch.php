<?php
/**
 * Anomaly Batch Analysis API
 * POST /api/anomaly/analyze-batch.php
 *
 * Triggers an on-demand backfill run of the anomaly engine against all
 * existing attendance data (rather than waiting for live NFC check-ins).
 * Proxies to the Python engine's POST /analyze/batch endpoint.
 *
 * This same endpoint is intended to be called by a daily cron job in the
 * future (e.g. after the nightly absent-flag job), so the engine keeps the
 * run idempotent per day.
 */

require_once '../../config/database.php';
require_once '../../utils/cors.php';
require_once '../../utils/session.php';

header('Content-Type: application/json');

// Require admin authentication
requireAdminAuth();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit();
}

$engineUrl = getenv('ANOMALY_ENGINE_URL') ?: 'http://localhost:5000';

// Batch analysis iterates every active student and runs all detectors, so
// allow a generous timeout compared with the 2s used for config calls.
$ch = curl_init($engineUrl . '/analyze/batch');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST          => true,
    CURLOPT_POSTFIELDS    => '{}',
    CURLOPT_TIMEOUT       => 120,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_HTTPHEADER    => [
        'Content-Type: application/json',
        'Accept: application/json',
    ],
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($response === false || $curlError) {
    http_response_code(503);
    echo json_encode([
        'success' => false,
        'message' => 'Anomaly engine is unavailable',
    ]);
    exit();
}

if ($httpCode < 200 || $httpCode >= 300) {
    $engineBody = json_decode($response, true);
    // Surface the engine's actual error detail so failures are diagnosable
    // from the UI instead of a generic message.
    $detail = null;
    if (is_array($engineBody)) {
        $detail = $engineBody['error'] ?? $engineBody['message'] ?? null;
    }
    if ($detail === null && is_string($response) && $response !== '') {
        $detail = substr($response, 0, 300);
    }

    http_response_code($httpCode);
    echo json_encode([
        'success' => false,
        'message' => $detail
            ? ('Anomaly engine error: ' . $detail)
            : ('Anomaly engine returned HTTP ' . $httpCode),
        'engine_response' => $engineBody,
    ]);
    exit();
}

// Wrap the engine's summary in the standard success envelope the frontend expects.
$summary = json_decode($response, true);
http_response_code(200);
echo json_encode([
    'success' => true,
    'message' => 'Batch analysis completed',
    'data' => $summary,
]);
exit();
?>
