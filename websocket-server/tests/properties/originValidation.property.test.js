// Feature: realtime-anomaly-detection, Property 19: Origin Validation
// **Validates: Requirements 8.4, 8.5**

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

describe('Property 19: Origin Validation', () => {
  let connectionManager;
  let config;

  beforeEach(() => {
    // Clear module cache to get fresh instances
    delete require.cache[require.resolve('../../src/connections/manager.js')];
    delete require.cache[require.resolve('../../src/config.js')];

    config = require('../../src/config.js');
    connectionManager = require('../../src/connections/manager.js');
  });

  afterEach(() => {
    delete require.cache[require.resolve('../../src/connections/manager.js')];
    delete require.cache[require.resolve('../../src/config.js')];
  });

  it('accepts any origin that is in the allowedOrigins list', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...config.allowedOrigins),
        (origin) => {
          expect(connectionManager.validateOrigin(origin)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects any origin NOT in the allowedOrigins list', () => {
    fc.assert(
      fc.property(
        fc.webUrl().filter((url) => !config.allowedOrigins.includes(url)),
        (origin) => {
          expect(connectionManager.validateOrigin(origin)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('rejects null or undefined origin', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined),
        (origin) => {
          expect(connectionManager.validateOrigin(origin)).toBe(false);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('is deterministic - same input always produces same output', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constantFrom(...config.allowedOrigins),
          fc.webUrl(),
          fc.constant(null),
          fc.constant(undefined)
        ),
        (origin) => {
          const result1 = connectionManager.validateOrigin(origin);
          const result2 = connectionManager.validateOrigin(origin);
          expect(result1).toBe(result2);
        }
      ),
      { numRuns: 100 }
    );
  });
});
