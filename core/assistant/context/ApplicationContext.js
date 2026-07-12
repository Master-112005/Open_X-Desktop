'use strict';

class ApplicationContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.application');
    this.priority = Number.isFinite(options.priority) ? options.priority : 110;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.reader = options.reader || null;
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  async collect(context) {
    const activeWindow = this.reader ? await this.reader(context) : context.snapshots.activeWindow || null;
    const apps = Array.isArray(context.snapshots.runningApplications) ? context.snapshots.runningApplications : [];
    context.context.runningApplications = apps.slice();
    context.context.application = {
      focusedApplication: activeWindow?.app || context.workingMemory.currentApplication || null,
      foregroundWindow: activeWindow || null,
      state: activeWindow ? 'focused' : 'unknown'
    };
    return context;
  }
}

module.exports = ApplicationContext;
