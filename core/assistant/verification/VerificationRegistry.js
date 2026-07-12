'use strict';

const { ConfigurationError } = require('./VerificationErrors');

class VerificationRegistry {
  constructor() {
    this.verifiers = new Map();
  }

  register(verifier, options = {}) {
    if (!verifier || typeof verifier.verify !== 'function') {
      throw new ConfigurationError('Verifier must provide verify(context).');
    }
    const id = String(options.id || verifier.id || verifier.constructor?.name || '').trim();
    if (!id) throw new ConfigurationError('Verifier id is required.');
    verifier.id = id;
    if (Number.isFinite(options.priority)) verifier.priority = Number(options.priority);
    if (options.enabled !== undefined) verifier.enabled = options.enabled !== false;
    this.verifiers.set(id, verifier);
    return this;
  }

  list({ includeDisabled = true } = {}) {
    return [...this.verifiers.values()]
      .filter(verifier => includeDisabled || verifier.enabled !== false)
      .sort((left, right) => (Number(left.priority) || 0) - (Number(right.priority) || 0) || String(left.id).localeCompare(String(right.id)));
  }

  health() {
    return this.list().map(verifier => ({
      id: verifier.id,
      version: verifier.version,
      priority: verifier.priority,
      enabled: verifier.enabled !== false,
      initialized: verifier.initialized === true
    }));
  }

  clear() { this.verifiers.clear(); }
}

module.exports = VerificationRegistry;
