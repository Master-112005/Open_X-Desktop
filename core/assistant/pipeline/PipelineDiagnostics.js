'use strict';

const PerformanceTracker = require('../utils/PerformanceTracker');
const { serializeError } = require('../utils/ErrorHelpers');

class PipelineDiagnostics {
  constructor(options = {}) {
    this.performance = options.performance || new PerformanceTracker();
    this.records = [];
  }

  record(level, message, data = {}) {
    const record = {
      level: String(level || 'info'),
      message: String(message || ''),
      data: { ...(data || {}) },
      timestamp: Date.now()
    };
    this.records.push(record);
    this.records = this.records.slice(-1000);
    return record;
  }

  recordStage(stageId, durationMs, metadata = {}) {
    return this.performance.record(`stage:${stageId}`, durationMs, metadata);
  }

  recordError(error, metadata = {}) {
    return this.record('error', error?.message || 'Pipeline error.', {
      ...metadata,
      error: serializeError(error)
    });
  }

  memorySnapshot() {
    if (typeof process === 'undefined' || typeof process.memoryUsage !== 'function') return null;
    const memory = process.memoryUsage();
    return {
      rss: memory.rss,
      heapTotal: memory.heapTotal,
      heapUsed: memory.heapUsed,
      external: memory.external
    };
  }

  list(limit = 100) {
    return this.records.slice(-Math.max(1, Number(limit) || 100));
  }
}

module.exports = PipelineDiagnostics;
