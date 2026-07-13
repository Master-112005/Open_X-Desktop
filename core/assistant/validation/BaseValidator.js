'use strict';

class BaseValidator {
  constructor(options = {}) {
    this.id = String(options.id || this.constructor.name);
    this.name = String(options.name || this.id);
    this.priority = Number.isFinite(options.priority) ? Number(options.priority) : 100;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.options = { ...(options || {}) };
    this.initialized = false;
  }

  initialize() {
    this.initialized = true;
    return true;
  }

  supports(context) {
    return this.enabled && !!context;
  }

  tasks(context) {
    return Array.isArray(context?.executionBlueprint?.tasks)
      ? context.executionBlueprint.tasks
      : [];
  }

  entities(context, task = null) {
    return {
      ...(context?.executionBlueprint?.metadata?.entities || {}),
      ...(task?.metadata?.entities || {})
    };
  }

  fail(context, message, data = {}) {
    return context.check(this.id, false, message, data);
  }

  pass(context, message, data = {}) {
    return context.check(this.id, true, message, data);
  }

  warn(context, message, data = {}) {
    return context.warn(this.id, message, data);
  }

  validate(context) {
    return context;
  }

  cleanup() {
    return true;
  }

  destroy() {
    this.initialized = false;
    return true;
  }
}

module.exports = BaseValidator;
