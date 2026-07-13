'use strict';

const PerformanceTracker = require('../utils/PerformanceTracker');
const { serializeError } = require('../utils/ErrorHelpers');

class PipelineDiagnostics {
  constructor(options = {}) {
    this.performance = options.performance || new PerformanceTracker();
    this.records = [];
    this.maxRecords = Number.isFinite(options.maxRecords) ? Math.max(25, Number(options.maxRecords)) : 1000;
  }

  record(level, message, data = {}) {
    const record = {
      level: String(level || 'info'),
      message: String(message || ''),
      data: { ...(data || {}) },
      timestamp: Date.now()
    };
    this.records.push(record);
    this.records = this.records.slice(-this.maxRecords);
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

  clear() {
    const count = this.records.length;
    this.records = [];
    return count;
  }

  summary(limit = 100) {
    const records = this.list(limit);
    const byLevel = records.reduce((summary, record) => {
      summary[record.level] = (summary[record.level] || 0) + 1;
      return summary;
    }, {});
    return {
      total: this.records.length,
      sampled: records.length,
      byLevel,
      memory: this.memorySnapshot(),
      performance: typeof this.performance.summary === 'function' ? this.performance.summary() : null
    };
  }
}

module.exports = PipelineDiagnostics;
