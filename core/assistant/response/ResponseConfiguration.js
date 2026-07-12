'use strict';

const DEFAULT_GENERATOR_OPTIONS = Object.freeze({ enabled: true, priority: 100 });

class ResponseConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || '11.0.0');
    this.strict = input.strict === true;
    this.voiceVerbosity = String(input.voiceVerbosity || 'concise');
    this.chatVerbosity = String(input.chatVerbosity || 'concise');
    this.suggestions = input.suggestions !== false;
    this.generators = { ...(input.generators || {}) };
  }

  getGeneratorOptions(id, defaults = {}) {
    return {
      ...DEFAULT_GENERATOR_OPTIONS,
      ...(defaults || {}),
      ...(this.generators[String(id || '')] || {})
    };
  }
}

module.exports = ResponseConfiguration;
