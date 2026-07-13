'use strict';

class BaseNormalizer {
  constructor(options = {}) {
    this.id = String(options.id || this.constructor.name);
    this.name = String(options.name || this.id);
    this.priority = Number.isFinite(options.priority) ? Number(options.priority) : 100;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.options = { ...(options || {}) };
    this.initialized = false;
    this.stats = { runs: 0, failures: 0, lastRunAt: null };
  }

  initialize() {
    this.initialized = true;
    return true;
  }

  supports() {
    return this.enabled;
  }

  getOption(key, fallback = undefined) {
    return Object.prototype.hasOwnProperty.call(this.options, key) ? this.options[key] : fallback;
  }

  markRun(success = true) {
    this.stats.runs += 1;
    if (!success) this.stats.failures += 1;
    this.stats.lastRunAt = Date.now();
    return this.stats;
  }

  describe() {
    return {
      id: this.id,
      name: this.name,
      priority: this.priority,
      enabled: this.enabled,
      version: this.version,
      initialized: this.initialized,
      stats: { ...this.stats }
    };
  }

  normalize(context) {
    return context;
  }

  validate(context) {
    return !!context;
  }

  cleanup() {
    return true;
  }

  destroy() {
    this.initialized = false;
    return true;
  }
}

module.exports = BaseNormalizer;
