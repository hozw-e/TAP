import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

describe('eventBuilder', () => {
  let validateEvent;

  beforeEach(async () => {
    const mod = await import('../src/events/eventBuilder.js');
    validateEvent = mod.validateEvent;
  });

  const validPayload = {
    student_id: 1,
    student_name: 'Juan Dela Cruz',
    action: 'check_in',
    timestamp: '2024-01-15T09:30:00Z',
    course: 'Arduino',
    attendance_flag: 'present',
  };

  it('accepts a valid complete payload', () => {
    const result = validateEvent(validPayload);
    expect(result.valid).toBe(true);
    expect(result.event).toEqual(validPayload);
  });

  it('accepts valid payload with null optional fields', () => {
    const result = validateEvent({
      ...validPayload,
      course: null,
      attendance_flag: null,
    });
    expect(result.valid).toBe(true);
    expect(result.event.course).toBeNull();
    expect(result.event.attendance_flag).toBeNull();
  });

  it('accepts valid payload with missing optional fields', () => {
    const { course, attendance_flag, ...required } = validPayload;
    const result = validateEvent(required);
    expect(result.valid).toBe(true);
    expect(result.event.course).toBeNull();
    expect(result.event.attendance_flag).toBeNull();
  });

  it('rejects null payload', () => {
    const result = validateEvent(null);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/JSON object/);
  });

  it('rejects missing student_id', () => {
    const { student_id, ...rest } = validPayload;
    const result = validateEvent(rest);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/student_id/);
  });

  it('rejects non-integer student_id', () => {
    const result = validateEvent({ ...validPayload, student_id: 1.5 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/positive integer/);
  });

  it('rejects negative student_id', () => {
    const result = validateEvent({ ...validPayload, student_id: -1 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/positive integer/);
  });

  it('rejects missing student_name', () => {
    const { student_name, ...rest } = validPayload;
    const result = validateEvent(rest);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/student_name/);
  });

  it('rejects empty student_name', () => {
    const result = validateEvent({ ...validPayload, student_name: '   ' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/non-empty/);
  });

  it('rejects student_name exceeding 100 characters', () => {
    const result = validateEvent({ ...validPayload, student_name: 'A'.repeat(101) });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/100/);
  });

  it('rejects invalid action', () => {
    const result = validateEvent({ ...validPayload, action: 'unknown' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/action/);
  });

  it('accepts check_out action', () => {
    const result = validateEvent({ ...validPayload, action: 'check_out' });
    expect(result.valid).toBe(true);
    expect(result.event.action).toBe('check_out');
  });

  it('rejects invalid timestamp format', () => {
    const result = validateEvent({ ...validPayload, timestamp: '2024/01/15 09:30' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/ISO 8601/);
  });

  it('accepts timestamp with timezone offset', () => {
    const result = validateEvent({ ...validPayload, timestamp: '2024-01-15T09:30:00+08:00' });
    expect(result.valid).toBe(true);
  });

  it('rejects invalid attendance_flag', () => {
    const result = validateEvent({ ...validPayload, attendance_flag: 'invalid' });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/attendance_flag/);
  });

  it('rejects non-string course', () => {
    const result = validateEvent({ ...validPayload, course: 123 });
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/course/);
  });

  it('trims student_name in the returned event', () => {
    const result = validateEvent({ ...validPayload, student_name: '  Juan  ' });
    expect(result.valid).toBe(true);
    expect(result.event.student_name).toBe('Juan');
  });
});

describe('broadcaster', () => {
  // Use createRequire to get the same module instances as the CJS source
  const connectionManager = require('../src/connections/manager.js');
  const { broadcast } = require('../src/events/broadcaster.js');
  const { WebSocket } = require('ws');

  beforeEach(() => {
    connectionManager.clients.clear();
  });

  it('returns 0 when no clients are connected', () => {
    const delivered = broadcast('attendance_event', { student_id: 1 });
    expect(delivered).toBe(0);
  });

  it('sends message to OPEN WebSocket clients', () => {
    const sent = [];
    const mockWs = {
      readyState: WebSocket.OPEN,
      send: (msg) => sent.push(msg),
    };
    connectionManager.clients.set('session-1', {
      ws: mockWs,
      adminId: 1,
      adminName: 'Admin',
      connectedAt: new Date().toISOString(),
    });

    const delivered = broadcast('attendance_event', { student_id: 1 });
    expect(delivered).toBe(1);
    expect(sent).toHaveLength(1);

    const parsed = JSON.parse(sent[0]);
    expect(parsed.type).toBe('attendance_event');
    expect(parsed.data.student_id).toBe(1);
  });

  it('removes clients with non-OPEN readyState', () => {
    const mockWs = {
      readyState: WebSocket.CLOSED,
      send: vi.fn(),
    };
    connectionManager.clients.set('session-dead', {
      ws: mockWs,
      adminId: 2,
      adminName: 'Admin2',
      connectedAt: new Date().toISOString(),
    });

    const delivered = broadcast('attendance_event', { student_id: 1 });
    expect(delivered).toBe(0);
    expect(connectionManager.getClient('session-dead')).toBeUndefined();
  });

  it('removes clients that throw on send', () => {
    const mockWs = {
      readyState: WebSocket.OPEN,
      send: () => { throw new Error('Connection reset'); },
    };
    connectionManager.clients.set('session-err', {
      ws: mockWs,
      adminId: 3,
      adminName: 'Admin3',
      connectedAt: new Date().toISOString(),
    });

    const delivered = broadcast('attendance_event', { student_id: 1 });
    expect(delivered).toBe(0);
    expect(connectionManager.getClient('session-err')).toBeUndefined();
  });

  it('broadcasts to multiple clients', () => {
    const sent1 = [];
    const sent2 = [];
    const mockWs1 = { readyState: WebSocket.OPEN, send: (msg) => sent1.push(msg) };
    const mockWs2 = { readyState: WebSocket.OPEN, send: (msg) => sent2.push(msg) };

    connectionManager.clients.set('session-a', {
      ws: mockWs1,
      adminId: 1,
      adminName: 'A',
      connectedAt: new Date().toISOString(),
    });
    connectionManager.clients.set('session-b', {
      ws: mockWs2,
      adminId: 2,
      adminName: 'B',
      connectedAt: new Date().toISOString(),
    });

    const delivered = broadcast('anomaly_alert', { score: 0.85 });
    expect(delivered).toBe(2);
    expect(sent1).toHaveLength(1);
    expect(sent2).toHaveLength(1);
  });

  it('constructs correct message format with type and data', () => {
    const sent = [];
    const mockWs = { readyState: WebSocket.OPEN, send: (msg) => sent.push(msg) };
    connectionManager.clients.set('session-fmt', {
      ws: mockWs,
      adminId: 1,
      adminName: 'Admin',
      connectedAt: new Date().toISOString(),
    });

    broadcast('engine_status', { available: false });

    const parsed = JSON.parse(sent[0]);
    expect(parsed).toHaveProperty('type', 'engine_status');
    expect(parsed).toHaveProperty('data');
    expect(parsed.data.available).toBe(false);
  });
});
