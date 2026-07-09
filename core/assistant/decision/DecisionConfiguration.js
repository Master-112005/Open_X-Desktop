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
    this.confirmationActions = new Set(input.confirmationActions || [
      'DELETE_FILE',
      'SYSTEM_SHUTDOWN',
      'SYSTEM_RESTART',
      'FORMAT_DRIVE',
      'SEND_EMAIL'
    ]);
    this.disabledActions = new Set(input.disabledActions || []);
    this.decisions = { ...(input.decisions || {}) };
  }

  getDecisionOptions(id, defaults = {}) {
    return {
      ...DEFAULT_DECISION_OPTIONS,
      ...(defaults || {}),
      ...(this.decisions[String(id || '')] || {})
    };
  }
}

module.exports = DecisionConfiguration;
