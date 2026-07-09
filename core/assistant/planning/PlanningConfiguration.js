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
}

module.exports = PlanningConfiguration;
