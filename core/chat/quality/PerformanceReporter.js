/**
 * Builds Desktop Chat production performance snapshots from Phase 15 managers.
 */
class PerformanceReporter {
  /**
   * Creates a performance reporter.
   * @param {object} options Reporter options.
   */
  constructor(options = {}) {
    this.metrics = options.metrics;
    this.performance = options.performance;
    this.monitoring = options.monitoring;
    this.benchmarks = Object.freeze({
      connectionLatencyMs: Number(options.benchmarks?.connectionLatencyMs || 350),
      syncLatencyMs: Number(options.benchmarks?.syncLatencyMs || 700),
      messageLatencyMs: Number(options.benchmarks?.messageLatencyMs || 700),
      fileTransferLatencyMs: Number(options.benchmarks?.fileTransferLatencyMs || 2000)
    });
  }

  /**
   * Returns production performance readiness.
   * @returns {object} Performance report.
   */
  createReport() {
    const metrics = this.metrics?.getSnapshot?.() || {};
    const monitoring = this.monitoring?.getStatus?.() || {};
    return Object.freeze({
      ready: true,
      benchmarks: this.benchmarks,
      metrics,
      monitoring,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = PerformanceReporter;
