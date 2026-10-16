import { describe, it, expect } from 'vitest';
import { getConnectionDisplay } from '../components/ConnectionStatus.jsx';

describe('ConnectionStatus - getConnectionDisplay', () => {
  it('should show green dot and "Live" for connected_ws (real-time WebSocket)', () => {
    const result = getConnectionDisplay('connected_ws');
    expect(result.dotColor).toBe('green');
    expect(result.label).toBe('Live');
    expect(result.showRetry).toBe(false);
  });

  it('should show amber dot and "Live (fallback)" for connected_sse', () => {
    const result = getConnectionDisplay('connected_sse');
    expect(result.dotColor).toBe('amber');
    expect(result.label).toBe('Live (fallback)');
    expect(result.showRetry).toBe(false);
  });

  it('should show red dot and "Reconnecting..." for connecting_ws', () => {
    const result = getConnectionDisplay('connecting_ws');
    expect(result.dotColor).toBe('red');
    expect(result.label).toBe('Reconnecting...');
    expect(result.showRetry).toBe(false);
  });

  it('should show red dot and "Reconnecting..." for connecting_sse', () => {
    const result = getConnectionDisplay('connecting_sse');
    expect(result.dotColor).toBe('red');
    expect(result.label).toBe('Reconnecting...');
    expect(result.showRetry).toBe(false);
  });

  it('should show red dot and "Reconnecting..." for reconnecting', () => {
    const result = getConnectionDisplay('reconnecting');
    expect(result.dotColor).toBe('red');
    expect(result.label).toBe('Reconnecting...');
    expect(result.showRetry).toBe(false);
  });

  it('should show red dot, "Offline", and retry for disconnected', () => {
    const result = getConnectionDisplay('disconnected');
    expect(result.dotColor).toBe('red');
    expect(result.label).toBe('Offline');
    expect(result.showRetry).toBe(true);
  });

  it('should return empty state for unknown connection state', () => {
    const result = getConnectionDisplay('unknown');
    expect(result.dotColor).toBe('none');
    expect(result.label).toBe('');
    expect(result.showRetry).toBe(false);
  });
});
