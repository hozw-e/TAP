const config = require('../config');
const logger = require('../utils/logger');
const { broadcast } = require('../events/broadcaster');

/**
 * Health monitor with circuit breaker for the Python anomaly engine.
 *
 * States:
 *   - closed: Normal operation, events forwarded to engine
 *   - open: Engine unreachable, events queued
 *   - halfOpen: Engine responded to health check, attempting recovery
 */
class HealthMonitor {
  constructor(broadcaster) {
    this.state = 'closed'; // closed, open, halfOpen
    this.consecutiveFailures = 0;
    this.interval = null;
    this._broadcast = broadcaster || broadcast;
  }

  /**
   * Start polling the anomaly engine health endpoint.
   * Polls every config.anomalyEngineHealthInterval (default 15s).
   */
  start() {
    this.interval = setInterval(() => this._poll(), config.anomalyEngineHealthInterval);
    logger.info('Health monitor started', {
      interval: config.anomalyEngineHealthInterval,
      url: `${config.anomalyEngineUrl}/health`,
    });
  }

  /**
   * Stop the health polling interval.
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Returns whether the anomaly engine is available for analysis.
   * @returns {boolean} true if state is 'closed' or 'halfOpen'
   */
  isAvailable() {
    return this.state !== 'open';
  }

  /**
   * Notify the monitor that an analysis request succeeded.
   * Transitions halfOpen → closed.
   */
  onAnalysisSuccess() {
    if (this.state === 'halfOpen') {
      this.state = 'closed';
      this.consecutiveFailures = 0;
      logger.info('Circuit breaker closed — anomaly engine recovered');
      this._broadcast('engine_status', { available: true });
    }
  }

  /**
   * Notify the monitor that an analysis request failed.
   * Transitions halfOpen → open.
   */
  onAnalysisFailure() {
    if (this.state === 'halfOpen') {
      this.state = 'open';
      logger.warn('Circuit breaker re-opened — analysis failed in half-open state');
      this._broadcast('engine_status', { available: false });
    }
  }

  /**
   * Internal: poll the health endpoint and update circuit breaker state.
   */
  async _poll() {
    const url = `${config.anomalyEngineUrl}/health`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    try {
      const response = await fetch(url, { signal: controller.signal });

      if (response.ok) {
        this._onHealthSuccess();
      } else {
        this._onHealthFailure();
      }
    } catch (err) {
      this._onHealthFailure();
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Handle a successful health check response.
   */
  _onHealthSuccess() {
    if (this.state === 'open') {
      // Transition from open → halfOpen
      this.state = 'halfOpen';
      this.consecutiveFailures = 0;
      logger.info('Circuit breaker half-open — health check passed, attempting recovery');
    } else if (this.state === 'halfOpen') {
      // Stay in halfOpen until an analysis succeeds
    } else {
      // Already closed, reset failure count
      this.consecutiveFailures = 0;
    }
  }

  /**
   * Handle a failed health check response.
   */
  _onHealthFailure() {
    this.consecutiveFailures++;

    logger.warn('Anomaly engine health check failed', {
      consecutiveFailures: this.consecutiveFailures,
      state: this.state,
    });

    if (this.consecutiveFailures >= 3 && this.state === 'closed') {
      this.state = 'open';
      logger.error('Circuit breaker opened — anomaly engine unreachable after 3 consecutive failures');
      this._broadcast('engine_status', { available: false });
    } else if (this.state === 'halfOpen') {
      // Health check failed in halfOpen — revert to open
      this.state = 'open';
      this._broadcast('engine_status', { available: false });
    }
  }
}

// Singleton instance (uses the real broadcaster)
const healthMonitor = new HealthMonitor();

module.exports = healthMonitor;
module.exports.HealthMonitor = HealthMonitor;
