'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

class TimingInformation {
  constructor({ startedAt = Date.now(), finishedAt = null, durationMs = 0, stages = [] } = {}) {
    this.startedAt = startedAt;
    this.finishedAt = finishedAt;
    this.durationMs = Math.max(0, Number(durationMs) || 0);
    this.stages = Array.isArray(stages) ? stages.slice() : [];
    deepFreeze(this);
  }
}

module.exports = TimingInformation;
