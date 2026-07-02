'use strict';

const { sanitizeMetadata } = require('./privacy');

/**
 * Purpose: Collects local Voice metrics.
 * Responsibility: Store sanitized metric values and metadata without changing voice behavior.
 * Dependencies: Privacy sanitizer.
 * Lifecycle: Owned by DiagnosticsManager.
 * Future extension notes: No subsystem should bypass DiagnosticsManager to write metrics.
 */
class MetricsCollector {
  constructor(options = {}) {
    this.clock = options.clock || (() => new Date());
    this.maxMetrics = Math.max(1, Number(options.maxMetrics) || 1000);
    this.metrics = [];
  }

  record(name, value = 1, metadata = {}) {
    const metric = Object.freeze({
      name: String(name || 'voice.metric'),
      value: Number(value) || 0,
      metadata: sanitizeMetadata(metadata),
      timestamp: this.clock().toISOString()
    });
    this.metrics.push(metric);
    this._trim();
    return metric;
  }

  list(limit = 100) {
    return this.metrics.slice(-Math.max(0, Number(limit) || 0));
  }

  summarize() {
    const totals = {};
    for (const metric of this.metrics) {
      totals[metric.name] = (totals[metric.name] || 0) + metric.value;
    }
    return { count: this.metrics.length, totals };
  }

  _trim() {
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.splice(0, this.metrics.length - this.maxMetrics);
    }
  }
}

module.exports = MetricsCollector;
