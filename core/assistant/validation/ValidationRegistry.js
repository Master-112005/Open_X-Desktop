'use strict';

const { ConfigurationError } = require('./ValidationErrors');

class ValidationRegistry {
  constructor() {
    this.validators = new Map();
  }

  register(validator, options = {}) {
    if (!validator || typeof validator.validate !== 'function') {
      throw new ConfigurationError('Validator must provide validate(context).');
    }
    const id = String(options.id || validator.id || validator.constructor?.name || '').trim();
    if (!id) throw new ConfigurationError('Validator id is required.');
    validator.id = id;
    if (Number.isFinite(options.priority)) validator.priority = Number(options.priority);
    if (options.enabled !== undefined) validator.enabled = options.enabled !== false;
    this.validators.set(id, validator);
    return this;
  }

  list({ includeDisabled = true } = {}) {
    return [...this.validators.values()]
      .filter(validator => includeDisabled || validator.enabled !== false)
      .sort((left, right) => (Number(left.priority) || 0) - (Number(right.priority) || 0) || String(left.id).localeCompare(String(right.id)));
  }

  health() {
    return this.list().map(validator => ({
      id: validator.id,
      version: validator.version,
      priority: validator.priority,
      enabled: validator.enabled !== false,
      initialized: validator.initialized === true
    }));
  }

  clear() {
    this.validators.clear();
  }
}

module.exports = ValidationRegistry;
