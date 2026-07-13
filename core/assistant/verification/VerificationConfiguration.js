'use strict';

const DEFAULT_VERIFIER_OPTIONS = Object.freeze({ enabled: true, priority: 100 });

class VerificationConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || '11.0.0');
    this.strict = input.strict === true;
    this.maxEvidence = Number.isFinite(input.maxEvidence) ? Math.max(25, Number(input.maxEvidence)) : 500;
    this.minVerifiedConfidence = Number.isFinite(input.minVerifiedConfidence)
      ? Math.max(0, Math.min(1, Number(input.minVerifiedConfidence)))
      : 0.6;
    this.verifiers = { ...(input.verifiers || {}) };
  }

  getVerifierOptions(id, defaults = {}) {
    return {
      ...DEFAULT_VERIFIER_OPTIONS,
      ...(defaults || {}),
      ...(this.verifiers[String(id || '')] || {})
    };
  }

  toJSON() {
    return {
      enabled: this.enabled,
      version: this.version,
      strict: this.strict,
      maxEvidence: this.maxEvidence,
      minVerifiedConfidence: this.minVerifiedConfidence,
      verifiers: { ...this.verifiers }
    };
  }
}

module.exports = VerificationConfiguration;
