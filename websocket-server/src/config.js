const config = {
  port: parseInt(process.env.WEBSOCKET_PORT, 10) || 3001,
  allowedOrigins: (process.env.WEBSOCKET_ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000,http://localhost:80,https://apsolutionstap.up.railway.app')
    .split(',')
    .map(origin => origin.trim()),
  anomalyEngineUrl: process.env.ANOMALY_ENGINE_URL || 'http://localhost:5000',
  anomalyEngineHealthInterval: parseInt(process.env.ANOMALY_ENGINE_HEALTH_INTERVAL, 10) || 15000,
  phpSessionValidateUrl: process.env.PHP_SESSION_VALIDATE_URL || 'https://thesisi-production.up.railway.app/api/auth/validate-session.php',
  phpSessionRecheckInterval: parseInt(process.env.PHP_SESSION_RECHECK_INTERVAL, 10) || 60000,
};

module.exports = config;
