'use strict';

class BaseDecision {
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

  decide(context) {
    return context;
  }

  cleanup() {
    return true;
  }

  tasks(context) {
    return Array.isArray(context?.executionBlueprint?.tasks)
      ? context.executionBlueprint.tasks
      : [];
  }

  taskEntities(task = {}, context = null) {
    return {
      ...(context?.executionBlueprint?.metadata?.entities || {}),
      ...(task.metadata?.entities || {})
    };
  }

  actionTarget(task = {}, context = null) {
    const entities = this.taskEntities(task, context);
    return String(
      entities.appName ||
      entities.filename ||
      entities.folderName ||
      entities.windowName ||
      entities.path ||
      entities.query ||
      task.metadata?.target ||
      ''
    ).trim().toLowerCase();
  }

  destroy() {
    this.initialized = false;
    return true;
  }
}

module.exports = BaseDecision;
