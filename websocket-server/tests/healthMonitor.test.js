import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

describe('anomaly/healthMonitor', () => {
  let HealthMonitor;
  let healthMonitor;
  let broadcastMock;
  let originalFetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.useFakeTimers();

    const mod = require('../src/anomaly/healthMonitor.js');
    HealthMonitor = mod.HealthMonitor;

    // Create a fresh instance with a mock broadcaster for each test
    broadcastMock = vi.fn();
    healthMonitor = new HealthMonitor(broadcastMock);
  });

  afterEach(() => {
    healthMonitor.stop();
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('starts in closed state', () => {
    expect(healthMonitor.state).toBe('closed');
    expect(healthMonitor.isAvailable()).toBe(true);
  });

  it('isAvailable returns true for closed and halfOpen states', () => {
    healthMonitor.state = 'closed';
    expect(healthMonitor.isAvailable()).toBe(true);

    healthMonitor.state = 'halfOpen';
    expect(healthMonitor.isAvailable()).toBe(true);
  });

  it('isAvailable returns false for open state', () => {
    healthMonitor.state = 'open';
    expect(healthMonitor.isAvailable()).toBe(false);
  });

  it('opens circuit after 3 consecutive health check failures', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    healthMonitor.start();

    // 1st failure
    await vi.advanceTimersByTimeAsync(15000);
    expect(healthMonitor.state).toBe('closed');
    expect(healthMonitor.consecutiveFailures).toBe(1);

    // 2nd failure
    await vi.advanceTimersByTimeAsync(15000);
    expect(healthMonitor.state).toBe('closed');
    expect(healthMonitor.consecutiveFailures).toBe(2);

    // 3rd failure — circuit opens
    await vi.advanceTimersByTimeAsync(15000);
    expect(healthMonitor.state).toBe('open');
    expect(healthMonitor.consecutiveFailures).toBe(3);
    expect(broadcastMock).toHaveBeenCalledWith('engine_status', { available: false });
  });

  it('transitions from open to halfOpen on successful health check', async () => {
    healthMonitor.state = 'open';
    healthMonitor.consecutiveFailures = 3;

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
    healthMonitor.start();

    await vi.advanceTimersByTimeAsync(15000);
    expect(healthMonitor.state).toBe('halfOpen');
    expect(healthMonitor.consecutiveFailures).toBe(0);
  });

  it('transitions from halfOpen to closed on analysis success', () => {
    healthMonitor.state = 'halfOpen';
    healthMonitor.onAnalysisSuccess();

    expect(healthMonitor.state).toBe('closed');
    expect(healthMonitor.consecutiveFailures).toBe(0);
    expect(broadcastMock).toHaveBeenCalledWith('engine_status', { available: true });
  });

  it('transitions from halfOpen to open on analysis failure', () => {
    healthMonitor.state = 'halfOpen';
    healthMonitor.onAnalysisFailure();

    expect(healthMonitor.state).toBe('open');
    expect(broadcastMock).toHaveBeenCalledWith('engine_status', { available: false });
  });

  it('resets consecutive failures on successful health check in closed state', async () => {
    healthMonitor.consecutiveFailures = 2;

    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
    healthMonitor.start();

    await vi.advanceTimersByTimeAsync(15000);
    expect(healthMonitor.consecutiveFailures).toBe(0);
    expect(healthMonitor.state).toBe('closed');
  });

  it('does not broadcast engine_status when already closed and check succeeds', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
    healthMonitor.start();

    await vi.advanceTimersByTimeAsync(15000);
    expect(broadcastMock).not.toHaveBeenCalled();
  });

  it('stop clears the polling interval', () => {
    globalThis.fetch = vi.fn();
    healthMonitor.start();
    expect(healthMonitor.interval).not.toBeNull();

    healthMonitor.stop();
    expect(healthMonitor.interval).toBeNull();
  });

  it('reverts halfOpen to open on health check failure', async () => {
    healthMonitor.state = 'halfOpen';

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('timeout'));
    healthMonitor.start();

    await vi.advanceTimersByTimeAsync(15000);
    expect(healthMonitor.state).toBe('open');
    expect(broadcastMock).toHaveBeenCalledWith('engine_status', { available: false });
  });
});
