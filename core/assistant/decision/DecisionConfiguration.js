'use strict';

const DEFAULT_DECISION_OPTIONS = Object.freeze({
  enabled: true,
  priority: 100
});

class DecisionConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || '10.0.0');
    this.strict = input.strict === true;
    this.shortCircuit = input.shortCircuit !== false;
    this.maxTasks = Number.isFinite(input.maxTasks) ? Math.max(1, Number(input.maxTasks)) : 100;
    this.confirmationActions = new Set(input.confirmationActions || [
      'DELETE_FILE',
      'DELETE_FOLDER',
      'PERMANENT_DELETE_FILE',
      'EMPTY_RECYCLE_BIN',
      'SYSTEM_SHUTDOWN',
      'SYSTEM_RESTART',
      'SYSTEM_SIGN_OUT',
      'FORMAT_DRIVE',
      'SEND_EMAIL'
    ]);
    this.disabledActions = new Set(input.disabledActions || []);
    this.allowedActions = Array.isArray(input.allowedActions) && input.allowedActions.length > 0
      ? new Set(input.allowedActions)
      : null;
    this.conflictRules = Array.isArray(input.conflictRules) ? input.conflictRules.slice() : [];
    this.decisions = { ...(input.decisions || {}) };
  }

  getDecisionOptions(id, defaults = {}) {
    return {
      ...DEFAULT_DECISION_OPTIONS,
      ...(defaults || {}),
      ...(this.decisions[String(id || '')] || {})
    };
  }

  toJSON() {
    return {
      enabled: this.enabled,
      version: this.version,
      strict: this.strict,
      shortCircuit: this.shortCircuit,
      maxTasks: this.maxTasks,
      confirmationActions: [...this.confirmationActions],
      disabledActions: [...this.disabledActions],
      allowedActions: this.allowedActions ? [...this.allowedActions] : null,
      conflictRules: this.conflictRules.slice(),
      decisions: { ...this.decisions }
    };
  }
}

module.exports = DecisionConfiguration;
