// Feature: realtime-anomaly-detection, Property 20: Invalid Session Token Rejection
// Validates: Requirements 8.2

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

// Mock fetch globally before importing the module under test
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock config and logger to avoid side effects
vi.mock('../../src/config', () => ({
  phpSessionValidateUrl: 'http://localhost:80/api/auth/validate-session.php',
}));

vi.mock('../../src/utils/logger', () => ({
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
}));

const { validateSession } = await import('../../src/auth/sessionValidator.js');

describe('Property 20: Invalid Session Token Rejection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects any token when backend returns { valid: false }', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (token) => {
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ valid: false }),
          });

          const result = await validateSession(token);

          expect(result).toEqual({ valid: false });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects any token when backend returns non-200 status', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.integer({ min: 400, max: 599 }),
        async (token, statusCode) => {
          mockFetch.mockResolvedValueOnce({
            ok: false,
            status: statusCode,
          });

          const result = await validateSession(token);

          expect(result).toEqual({ valid: false });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects null, undefined, and empty string tokens without making HTTP call', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(null, undefined, ''),
        async (token) => {
          const result = await validateSession(token);

          expect(result).toEqual({ valid: false });
          // Should not make any HTTP request for falsy tokens
          expect(mockFetch).not.toHaveBeenCalled();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects any token when request times out (AbortError)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (token) => {
          const abortError = new Error('The operation was aborted');
          abortError.name = 'AbortError';
          mockFetch.mockRejectedValueOnce(abortError);

          const result = await validateSession(token);

          expect(result).toEqual({ valid: false });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects any token when request encounters a network error', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        async (token) => {
          mockFetch.mockRejectedValueOnce(new Error('Network error'));

          const result = await validateSession(token);

          expect(result).toEqual({ valid: false });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('accepts valid token only when backend returns { valid: true } with admin data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }),
        fc.integer({ min: 1, max: 10000 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        async (token, adminId, adminName) => {
          mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              valid: true,
              admin_id: adminId,
              admin_name: adminName,
            }),
          });

          const result = await validateSession(token);

          expect(result).toEqual({
            valid: true,
            admin_id: adminId,
            admin_name: adminName,
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
