'use strict';

const DEFAULT_PLANNER_OPTIONS = Object.freeze({
  enabled: true,
  priority: 100,
  strategy: 'deterministic'
});

class PlanningConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || '9.0.0');
    this.strict = input.strict === true;
    this.strategy = String(input.strategy || 'deterministic');
    this.optimizationLevel = String(input.optimizationLevel || 'safe');
    this.parallelPlanning = input.parallelPlanning !== false;
    this.recoveryPlanning = input.recoveryPlanning !== false;
    this.maxTasks = Number.isFinite(input.maxTasks) ? Math.max(1, Number(input.maxTasks)) : 100;
    this.defaultTaskDurationSeconds = Number.isFinite(input.defaultTaskDurationSeconds)
      ? Math.max(1, Number(input.defaultTaskDurationSeconds))
      : 30;
    this.actionDurations = {
      OPEN_APPLICATION: 10,
      CLOSE_APPLICATION: 8,
      SEARCH_WEB: 15,
      PLAY_MEDIA: 12,
      SET_VOLUME: 4,
      MUTE_AUDIO: 3,
      OPEN_FOLDER: 8,
      OPEN_FILE: 8,
      DELETE_FILE: 12,
      MOVE_FILE: 20,
      CREATE_REMINDER: 10,
      ...(input.actionDurations || {})
    };
    this.sequentialWorkflows = new Set(input.sequentialWorkflows || ['email', 'file', 'system']);
    this.parallelActions = new Set(input.parallelActions || ['OPEN_APPLICATION', 'SEARCH_WEB', 'OPEN_FOLDER', 'OPEN_FILE']);
    this.planners = { ...(input.planners || {}) };
    this.providers = { ...(input.providers || {}) };
  }

  getPlannerOptions(id, defaults = {}) {
    return {
      ...DEFAULT_PLANNER_OPTIONS,
      ...(defaults || {}),
      ...(this.planners[String(id || '')] || {})
    };
  }

  durationForAction(action) {
    return Number(this.actionDurations[String(action || '')]) || this.defaultTaskDurationSeconds;
  }

  toJSON() {
    return {
      enabled: this.enabled,
      version: this.version,
      strict: this.strict,
      strategy: this.strategy,
      optimizationLevel: this.optimizationLevel,
      parallelPlanning: this.parallelPlanning,
      recoveryPlanning: this.recoveryPlanning,
      maxTasks: this.maxTasks,
      defaultTaskDurationSeconds: this.defaultTaskDurationSeconds,
      actionDurations: { ...this.actionDurations },
      sequentialWorkflows: [...this.sequentialWorkflows],
      parallelActions: [...this.parallelActions],
      planners: { ...this.planners }
    };
  }
}

module.exports = PlanningConfiguration;
