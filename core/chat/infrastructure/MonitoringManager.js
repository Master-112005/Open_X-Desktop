/**
 * Aggregates Desktop Chat infrastructure status.
 */
class MonitoringManager {
  /**
   * Creates a monitoring manager.
   * @param {object} options Manager options.
   */
  constructor(options = {}) {
    this.metrics = options.metrics;
    this.performance = options.performance;
    this.connection = options.connection;
    this.storage = options.storage;
    this.memory = options.memory;
    this.synchronization = options.synchronization;
  }

  /**
   * Returns local infrastructure status.
   * @returns {object} Status.
   */
  getStatus() {
    return {
      metrics: this.metrics?.getSnapshot?.() || null,
      performance: this.performance?.getStatus?.() || null,
      connection: this.connection?.getStatus?.() || null,
      storage: this.storage?.getStatus?.() || null,
      memory: this.memory?.getStatus?.() || null,
      synchronization: {
        defaultBatchSize: this.synchronization?.defaultBatchSize || 0,
        maxBatchSize: this.synchronization?.maxBatchSize || 0
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = MonitoringManager;
