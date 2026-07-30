import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('anomaly/client - analyzeEvent', () => {
  let analyzeEvent;
  let originalFetch;

  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    // Dynamic import to get fresh module
    const mod = await import('../src/anomaly/client.js');
    analyzeEvent = mod.analyzeEvent;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns alerts from a successful response', async () => {
    const mockAlerts = [
      {
        student_id: 1,
        student_name: 'Juan',
        pattern_type: 'chronic_tardiness',
        score: 0.85,
        description: 'Juan has been late 7 of 10 sessions',
        detected_at: '2024-01-15T10:00:00Z',
      },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ alerts: mockAlerts }),
    });

    const event = {
      student_id: 1,
      student_name: 'Juan',
      action: 'check_in',
      timestamp: '2024-01-15T09:30:00Z',
      course: 'Arduino',
      attendance_flag: 'present',
    };

    const result = await analyzeEvent(event);
    expect(result).toEqual({ alerts: mockAlerts });
    expect(globalThis.fetch).toHaveBeenCalledOnce();

    const [url, options] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('http://localhost:5000/analyze');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual(event);
  });

  it('returns null on non-OK response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });

    const result = await analyzeEvent({ student_id: 1 });
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await analyzeEvent({ student_id: 1 });
    expect(result).toBeNull();
  });

  it('returns null on timeout (AbortError)', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    globalThis.fetch = vi.fn().mockRejectedValue(abortError);

    const result = await analyzeEvent({ student_id: 1 });
    expect(result).toBeNull();
  });

  it('returns empty alerts array when engine returns no anomalies', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ alerts: [] }),
    });

    const result = await analyzeEvent({ student_id: 1 });
    expect(result).toEqual({ alerts: [] });
  });
});
