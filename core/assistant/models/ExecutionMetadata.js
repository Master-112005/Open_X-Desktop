'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

const STATUSES = new Set(['pending', 'running', 'completed', 'failed', 'cancelled', 'skipped']);

class ExecutionMetadata {
  constructor({ status = 'pending', startedAt = null, finishedAt = null, durationMs = 0, attempt = 1, executor = '', error = null } = {}) {
    const normalizedStatus = String(status || 'pending').toLowerCase();
    this.status = STATUSES.has(normalizedStatus) ? normalizedStatus : 'pending';
    this.startedAt = startedAt;
    this.finishedAt = finishedAt;
    this.durationMs = Math.max(0, Number(durationMs) || 0);
    this.attempt = Math.max(1, Number(attempt) || 1);
    this.executor = String(executor || '');
    this.error = error ? {
      name: error.name || 'Error',
      message: String(error.message || error)
    } : null;
    deepFreeze(this);
  }

  get terminal() {
    return ['completed', 'failed', 'cancelled', 'skipped'].includes(this.status);
  }

  toJSON() {
    return {
      status: this.status,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      durationMs: this.durationMs,
      attempt: this.attempt,
      executor: this.executor,
      error: this.error
    };
  }
}

module.exports = ExecutionMetadata;
