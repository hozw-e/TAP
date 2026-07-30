import { describe, it, expect, afterAll } from 'vitest';

describe('WebSocket Server Setup', () => {
  it('config loads with correct defaults', async () => {
    const config = await import('../src/config.js');
    expect(config.default.port).toBe(3001);
    expect(config.default.allowedOrigins).toContain('http://localhost:5173');
    expect(config.default.allowedOrigins).toContain('http://localhost:80');
    expect(config.default.anomalyEngineUrl).toBe('http://localhost:5000');
    expect(config.default.anomalyEngineHealthInterval).toBe(15000);
    expect(config.default.phpSessionValidateUrl).toBe('http://localhost:80/api/auth/validate-session.php');
    expect(config.default.phpSessionRecheckInterval).toBe(60000);
  });

  it('logger exposes info, warn, error, debug methods', async () => {
    const logger = await import('../src/utils/logger.js');
    expect(typeof logger.default.info).toBe('function');
    expect(typeof logger.default.warn).toBe('function');
    expect(typeof logger.default.error).toBe('function');
    expect(typeof logger.default.debug).toBe('function');
  });

  it('index.js exports app, server, and wss', async () => {
    const { app, server, wss } = await import('../src/index.js');
    expect(app).toBeDefined();
    expect(server).toBeDefined();
    expect(wss).toBeDefined();

    // Clean up - close the server after test
    await new Promise((resolve) => {
      server.close(resolve);
    });
  });
});
