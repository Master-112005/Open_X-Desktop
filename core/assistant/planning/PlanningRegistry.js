'use strict';

const { ConfigurationError } = require('./PlanningErrors');

class PlanningRegistry {
  constructor() {
    this.planners = new Map();
  }

  register(planner, options = {}) {
    if (!planner || typeof planner.plan !== 'function') {
      throw new ConfigurationError('Planner must provide plan(context).');
    }
    const id = String(options.id || planner.id || planner.constructor?.name || '').trim();
    if (!id) throw new ConfigurationError('Planner id is required.');
    planner.id = id;
    if (Number.isFinite(options.priority)) planner.priority = Number(options.priority);
    if (options.enabled !== undefined) planner.enabled = options.enabled !== false;
    this.planners.set(id, planner);
    return this;
  }

  get(id) {
    return this.planners.get(String(id || '').trim()) || null;
  }

  unregister(id) {
    return this.planners.delete(String(id || '').trim());
  }

  list({ includeDisabled = true } = {}) {
    return [...this.planners.values()]
      .filter(planner => includeDisabled || planner.enabled !== false)
      .sort((left, right) => (Number(left.priority) || 0) - (Number(right.priority) || 0) || String(left.id).localeCompare(String(right.id)));
  }

  health() {
    return this.list().map(planner => ({
      id: planner.id,
      version: planner.version,
      priority: planner.priority,
      enabled: planner.enabled !== false,
      initialized: planner.initialized === true
    }));
  }

  clear() {
    const count = this.planners.size;
    this.planners.clear();
    return count;
  }
}

module.exports = PlanningRegistry;
