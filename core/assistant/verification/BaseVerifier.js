'use strict';

class BaseVerifier {
  constructor(options = {}) {
    this.id = String(options.id || this.constructor.name);
    this.name = String(options.name || this.id);
    this.priority = Number.isFinite(options.priority) ? Number(options.priority) : 100;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.options = { ...(options || {}) };
    this.initialized = false;
  }

  initialize() { this.initialized = true; return true; }
  supports(context) { return this.enabled && !!context; }
  actions(context) {
    return [
      ...(context?.successfulActions || []),
      ...(context?.failedActions || []),
      ...(context?.skippedActions || [])
    ];
  }

  completedAndFailed(context) {
    return [
      ...(context?.successfulActions || []),
      ...(context?.failedActions || [])
    ];
  }

  addActionEvidence(context, type, action, successMessage, failureMessage, extra = {}) {
    const success = action?.success !== false && !context.failedActions.includes(action);
    return context.addEvidence(type, success ? successMessage : failureMessage, {
      taskId: action?.taskId || null,
      action: action?.action || null,
      route: action?.route || null,
      ...extra
    }, {
      status: success ? 'verified' : 'failed',
      confidence: success ? 0.86 : 0.28,
      source: this.id
    });
  }

  routeMatches(action, pattern) {
    return pattern.test(String(action?.route || action?.action || ''));
  }

  verify(context) { return context; }
  cleanup() { return true; }
  destroy() { this.initialized = false; return true; }
}

module.exports = BaseVerifier;
