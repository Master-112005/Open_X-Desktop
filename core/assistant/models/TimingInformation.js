'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

class TimingInformation {
  constructor({ startedAt = Date.now(), finishedAt = null, durationMs = 0, stages = [] } = {}) {
    this.startedAt = startedAt;
    this.finishedAt = finishedAt;
    this.durationMs = Math.max(0, Number(durationMs) || 0);
    this.stages = Array.isArray(stages)
      ? stages.slice(-200).map(stage => ({
        stageId: String(stage.stageId || stage.id || ''),
        durationMs: Math.max(0, Number(stage.durationMs) || 0),
        success: stage.success !== false
      }))
      : [];
    this.stageDurationMs = this.stages.reduce((sum, stage) => sum + stage.durationMs, 0);
    this.slowestStage = this.stages.reduce((slowest, stage) => (
      !slowest || stage.durationMs > slowest.durationMs ? stage : slowest
    ), null);
    deepFreeze(this);
  }

  toJSON() {
    return {
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      durationMs: this.durationMs,
      stages: this.stages,
      stageDurationMs: this.stageDurationMs,
      slowestStage: this.slowestStage
    };
  }
}

module.exports = TimingInformation;
