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
    this.maxChecks = Number.isFinite(input.maxChecks) ? Math.max(50, Number(input.maxChecks)) : 1000;
    this.validators = { ...(input.validators || {}) };
    this.permissions = { ...(input.permissions || {}) };
    this.allowedActions = Array.isArray(input.allowedActions) ? input.allowedActions.slice() : null;
    this.deniedActions = Array.isArray(input.deniedActions) ? input.deniedActions.slice() : [];
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

  toJSON() {
    return {
      enabled: this.enabled,
      version: this.version,
      strict: this.strict,
      maxChecks: this.maxChecks,
      validators: { ...this.validators },
      permissions: { ...this.permissions },
      allowedActions: this.allowedActions ? this.allowedActions.slice() : null,
      deniedActions: this.deniedActions.slice(),
      safety: {
        ...this.safety,
        dangerousActions: [...(this.safety.dangerousActions || [])]
      }
    };
  }
}

module.exports = ValidationConfiguration;
