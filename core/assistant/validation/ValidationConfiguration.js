'use strict';

const DEFAULT_VALIDATOR_OPTIONS = Object.freeze({
  enabled: true,
  priority: 100
});

class ValidationConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || '10.0.0');
    this.strict = input.strict === true;
    this.validators = { ...(input.validators || {}) };
    this.permissions = { ...(input.permissions || {}) };
    this.safety = {
      dangerousActions: new Set(input.safety?.dangerousActions || ['DELETE_FILE', 'FORMAT_DRIVE', 'SYSTEM_SHUTDOWN', 'SYSTEM_RESTART']),
      ...(input.safety || {})
    };
    if (!(this.safety.dangerousActions instanceof Set)) {
      this.safety.dangerousActions = new Set(this.safety.dangerousActions || []);
    }
  }

  getValidatorOptions(id, defaults = {}) {
    return {
      ...DEFAULT_VALIDATOR_OPTIONS,
      ...(defaults || {}),
      ...(this.validators[String(id || '')] || {})
    };
  }
}

module.exports = ValidationConfiguration;
