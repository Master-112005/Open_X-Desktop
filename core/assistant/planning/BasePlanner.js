'use strict';

class BasePlanner {
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

  plan(context) {
    return context;
  }

  taskId(value) {
    return String(value || 'task')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '') || 'task';
  }

  tasks(context) {
    return Array.isArray(context?.tasks) ? context.tasks : [];
  }

  taskEntities(task = {}, context = null) {
    return {
      ...(context?.reasoningResult?.metadata?.entities || {}),
      ...(context?.metadata?.entities || {}),
      ...(task.metadata?.entities || {})
    };
  }

  actionTarget(task = {}, context = null) {
    const entities = this.taskEntities(task, context);
    return String(
      entities.appName ||
      entities.filename ||
      entities.folderName ||
      entities.contactName ||
      entities.query ||
      entities.path ||
      task.metadata?.target ||
      ''
    ).trim().toLowerCase();
  }

  cleanup() {
    return true;
  }

  destroy() {
    this.initialized = false;
    return true;
  }
}

module.exports = BasePlanner;
