'use strict';

class BaseLearningModule {
  constructor(options = {}) {
    this.id = String(options.id || this.constructor.name);
    this.name = String(options.name || this.id);
    this.priority = Number.isFinite(options.priority) ? Number(options.priority) : 100;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.options = { ...(options || {}) };
    this.initialized = false;
    this.stats = {
      runs: 0,
      successes: 0,
      failures: 0,
      skipped: 0,
      lastRunAt: null,
      lastDurationMs: 0,
      lastError: null
    };
  }

  initialize() { this.initialized = true; return true; }
  supports(context) { return this.enabled && !!context; }
  learn(context) { return context; }
  cleanup() { return true; }
  destroy() { this.initialized = false; return true; }
  markRun({ success = true, skipped = false, durationMs = 0, error = null } = {}) {
    this.stats.runs += 1;
    if (skipped) this.stats.skipped += 1;
    else if (success) this.stats.successes += 1;
    else this.stats.failures += 1;
    this.stats.lastRunAt = new Date().toISOString();
    this.stats.lastDurationMs = Math.max(0, Number(durationMs) || 0);
    this.stats.lastError = error ? String(error.message || error).slice(0, 240) : null;
    return { ...this.stats };
  }

  getOption(key, fallback = undefined) {
    return Object.prototype.hasOwnProperty.call(this.options, key) ? this.options[key] : fallback;
  }

  describe() {
    return {
      id: this.id,
      name: this.name,
      priority: this.priority,
      enabled: this.enabled,
      initialized: this.initialized,
      version: this.version,
      stats: { ...this.stats }
    };
  }
}

module.exports = BaseLearningModule;
