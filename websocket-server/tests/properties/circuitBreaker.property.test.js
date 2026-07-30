// Feature: realtime-anomaly-detection, Property 21: Circuit Breaker State Transition
// **Validates: Requirements 10.3**

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { HealthMonitor } = require('../../src/anomaly/healthMonitor.js');

describe('Property 21: Circuit Breaker State Transition', () => {
  /**
   * Helper: create a fresh HealthMonitor with a no-op broadcaster
   */
  function createMonitor() {
    return new HealthMonitor(() => {});
  }

  it('circuit opens iff 3 consecutive failures occurred from closed state', () => {
    fc.assert(
      fc.property(
        // Generate a sequence of health check results (true = success, false = failure)
        fc.array(fc.boolean(), { minLength: 1, maxLength: 50 }),
        (healthChecks) => {
          const monitor = createMonitor();

          for (const success of healthChecks) {
            if (success) {
              monitor._onHealthSuccess();
            } else {
              monitor._onHealthFailure();
            }
          }

          // Count the max consecutive failures from the last reset point
          // The circuit should be open iff there were 3+ consecutive failures
          // while in closed state at some point
          let consecutiveFailures = 0;
          let opened = false;
          let simState = 'closed';

          for (const success of healthChecks) {
            if (simState === 'closed') {
              if (success) {
                consecutiveFailures = 0;
              } else {
                consecutiveFailures++;
                if (consecutiveFailures >= 3) {
                  simState = 'open';
                  opened = true;
                }
              }
            } else if (simState === 'open') {
              if (success) {
                simState = 'halfOpen';
                consecutiveFailures = 0;
              }
            } else if (simState === 'halfOpen') {
              if (!success) {
                simState = 'open';
              }
              // stays halfOpen on success (needs onAnalysisSuccess to close)
            }
          }

          expect(monitor.state).toBe(simState);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('a single health success in open state transitions to halfOpen, not closed', () => {
    fc.assert(
      fc.property(
        // Generate number of extra failures after opening (0-10)
        fc.nat({ max: 10 }),
        (extraFailures) => {
          const monitor = createMonitor();

          // Force circuit open with 3 failures
          monitor._onHealthFailure();
          monitor._onHealthFailure();
          monitor._onHealthFailure();
          expect(monitor.state).toBe('open');

          // Add some extra failures while open (should stay open)
          for (let i = 0; i < extraFailures; i++) {
            monitor._onHealthFailure();
          }
          expect(monitor.state).toBe('open');

          // Single success should transition to halfOpen, NOT closed
          monitor._onHealthSuccess();
          expect(monitor.state).toBe('halfOpen');
          expect(monitor.state).not.toBe('closed');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('a successful analysis in halfOpen transitions to closed', () => {
    fc.assert(
      fc.property(
        // Generate number of health successes while in halfOpen before analysis
        fc.nat({ max: 5 }),
        (extraHealthSuccesses) => {
          const monitor = createMonitor();

          // Force to halfOpen state
          monitor._onHealthFailure();
          monitor._onHealthFailure();
          monitor._onHealthFailure();
          monitor._onHealthSuccess();
          expect(monitor.state).toBe('halfOpen');

          // Extra health successes keep it in halfOpen
          for (let i = 0; i < extraHealthSuccesses; i++) {
            monitor._onHealthSuccess();
          }
          expect(monitor.state).toBe('halfOpen');

          // Analysis success closes the circuit
          monitor.onAnalysisSuccess();
          expect(monitor.state).toBe('closed');
          expect(monitor.consecutiveFailures).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('isAvailable() returns false iff state is open', () => {
    fc.assert(
      fc.property(
        // Generate a sequence of health check results
        fc.array(fc.boolean(), { minLength: 0, maxLength: 30 }),
        // Whether to call onAnalysisSuccess at the end
        fc.boolean(),
        (healthChecks, callAnalysisSuccess) => {
          const monitor = createMonitor();

          for (const success of healthChecks) {
            if (success) {
              monitor._onHealthSuccess();
            } else {
              monitor._onHealthFailure();
            }
          }

          if (callAnalysisSuccess && monitor.state === 'halfOpen') {
            monitor.onAnalysisSuccess();
          }

          // isAvailable should be false iff state is open
          if (monitor.state === 'open') {
            expect(monitor.isAvailable()).toBe(false);
          } else {
            expect(monitor.isAvailable()).toBe(true);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
