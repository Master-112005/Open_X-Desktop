/**
 * Desktop synchronization retry policy.
 */
class RetryManager {
  /**
   * Creates retry manager.
   * @param {object} options Options.
   */
  constructor(options = {}) {
    this.config = options.config;
    this.retryCount = 0;
  }

  /**
   * Records failure and returns next retry delay.
   * @returns {object} Retry state.
   */
  recordFailure() {
    this.retryCount += 1;
    const exceeded = this.retryCount > this.config.maxRetries;
    return {
      retryCount: this.retryCount,
      exceeded,
      nextDelayMs: exceeded ? null : Math.min(this.config.retryMaxDelayMs, this.config.retryBaseDelayMs * (2 ** Math.max(0, this.retryCount - 1)))
    };
  }

  /**
   * Resets retry state.
   */
  reset() {
    this.retryCount = 0;
  }
}

module.exports = RetryManager;
