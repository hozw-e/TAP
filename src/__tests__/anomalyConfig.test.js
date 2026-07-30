import { describe, it, expect } from 'vitest';
import { validateThreshold, validateWindow } from '../components/AnomalyConfig.jsx';

describe('AnomalyConfig - validateThreshold', () => {
  it('should accept 0.5 (lower bound)', () => {
    const result = validateThreshold(0.5);
    expect(result.valid).toBe(true);
    expect(result.message).toBe('');
  });

  it('should accept 1.0 (upper bound)', () => {
    const result = validateThreshold(1.0);
    expect(result.valid).toBe(true);
    expect(result.message).toBe('');
  });

  it('should accept 0.7 (middle value)', () => {
    const result = validateThreshold(0.7);
    expect(result.valid).toBe(true);
    expect(result.message).toBe('');
  });

  it('should accept string "0.75"', () => {
    const result = validateThreshold('0.75');
    expect(result.valid).toBe(true);
    expect(result.message).toBe('');
  });

  it('should reject 0.49 (below range)', () => {
    const result = validateThreshold(0.49);
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Threshold must be between 0.5 and 1.0');
  });

  it('should reject 1.01 (above range)', () => {
    const result = validateThreshold(1.01);
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Threshold must be between 0.5 and 1.0');
  });

  it('should reject non-numeric value', () => {
    const result = validateThreshold('abc');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Threshold must be a number');
  });

  it('should reject 0 (below range)', () => {
    const result = validateThreshold(0);
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Threshold must be between 0.5 and 1.0');
  });
});

describe('AnomalyConfig - validateWindow', () => {
  it('should accept 7 (lower bound)', () => {
    const result = validateWindow(7);
    expect(result.valid).toBe(true);
    expect(result.message).toBe('');
  });

  it('should accept 90 (upper bound)', () => {
    const result = validateWindow(90);
    expect(result.valid).toBe(true);
    expect(result.message).toBe('');
  });

  it('should accept 30 (middle value)', () => {
    const result = validateWindow(30);
    expect(result.valid).toBe(true);
    expect(result.message).toBe('');
  });

  it('should accept string "45"', () => {
    const result = validateWindow('45');
    expect(result.valid).toBe(true);
    expect(result.message).toBe('');
  });

  it('should reject 6 (below range)', () => {
    const result = validateWindow(6);
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Window must be between 7 and 90 days');
  });

  it('should reject 91 (above range)', () => {
    const result = validateWindow(91);
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Window must be between 7 and 90 days');
  });

  it('should reject non-integer value', () => {
    const result = validateWindow(7.5);
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Window must be a whole number');
  });

  it('should reject non-numeric value', () => {
    const result = validateWindow('abc');
    expect(result.valid).toBe(false);
    expect(result.message).toBe('Window must be a whole number');
  });
});
