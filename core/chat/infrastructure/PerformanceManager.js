/**
 * Measures Desktop Chat operations and produces local performance status.
 */
class PerformanceManager {
  /**
   * Creates a performance manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.metrics = options.metrics;
    this.eventBus = options.eventBus;
    this.slowOperationMs = Number(options.slowOperationMs || 700);
  }

  /**
   * Measures an asynchronous operation.
   * @param {string} name Operation name.
   * @param {Function} task Async task.
   * @returns {Promise<*>} Task result.
   */
  async measure(name, task) {
    const startedAt = Date.now();
    try {
      return await task();
    } finally {
      const durationMs = Date.now() - startedAt;
      this.metrics?.recordLatency?.(name, durationMs);
      if (durationMs > this.slowOperationMs) {
        this.eventBus?.emit('chat.infrastructure.performance_warning', { name, durationMs });
      }
    }
  }

  /**
   * Returns performance status.
   * @returns {object} Performance status.
   */
  getStatus() {
    const metrics = this.metrics?.getSnapshot?.() || {};
    return {
      latency: metrics.latency || { count: 0, p50Ms: 0, p95Ms: 0 },
      slowOperationMs: this.slowOperationMs,
      warning: (metrics.latency?.p95Ms || 0) > this.slowOperationMs,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = PerformanceManager;
