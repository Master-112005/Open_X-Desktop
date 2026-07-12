'use strict';

const DEFAULT_VERIFIER_OPTIONS = Object.freeze({ enabled: true, priority: 100 });

class VerificationConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || '11.0.0');
    this.strict = input.strict === true;
    this.verifiers = { ...(input.verifiers || {}) };
  }

  getVerifierOptions(id, defaults = {}) {
    return {
      ...DEFAULT_VERIFIER_OPTIONS,
      ...(defaults || {}),
      ...(this.verifiers[String(id || '')] || {})
    };
  }
}

module.exports = VerificationConfiguration;
