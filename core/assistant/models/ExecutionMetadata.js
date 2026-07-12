'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

class ExecutionMetadata {
  constructor({ status = 'pending', startedAt = null, finishedAt = null, durationMs = 0 } = {}) {
    this.status = String(status || 'pending');
    this.startedAt = startedAt;
    this.finishedAt = finishedAt;
    this.durationMs = Math.max(0, Number(durationMs) || 0);
    deepFreeze(this);
  }
}

module.exports = ExecutionMetadata;
