import { describe, it, expect } from 'vitest';
import { computeBackoffDelay } from './useWebSocket.js';

describe('computeBackoffDelay', () => {
  it('returns 1000ms for attempt 1', () => {
    expect(computeBackoffDelay(1)).toBe(1000);
  });

  it('returns 2000ms for attempt 2', () => {
    expect(computeBackoffDelay(2)).toBe(2000);
  });

  it('returns 4000ms for attempt 3', () => {
    expect(computeBackoffDelay(3)).toBe(4000);
  });

  it('returns 8000ms for attempt 4', () => {
    expect(computeBackoffDelay(4)).toBe(8000);
  });

  it('returns 16000ms for attempt 5', () => {
    expect(computeBackoffDelay(5)).toBe(16000);
  });

  it('caps at 30000ms for attempt 6 and above', () => {
    expect(computeBackoffDelay(6)).toBe(30000);
    expect(computeBackoffDelay(7)).toBe(30000);
    expect(computeBackoffDelay(8)).toBe(30000);
    expect(computeBackoffDelay(9)).toBe(30000);
    expect(computeBackoffDelay(10)).toBe(30000);
  });

  it('follows formula: min(2^(n-1) * 1000, 30000)', () => {
    for (let n = 1; n <= 10; n++) {
      const expected = Math.min(Math.pow(2, n - 1) * 1000, 30000);
      expect(computeBackoffDelay(n)).toBe(expected);
    }
  });
});
