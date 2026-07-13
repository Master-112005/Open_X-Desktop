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
    this.maxVoiceLength = Number(input.maxVoiceLength || 900);
    this.maxChatLength = Number(input.maxChatLength || 2400);
    this.maxNotificationLength = Number(input.maxNotificationLength || 120);
    this.maxParts = Number(input.maxParts || 20);
    this.maxSuggestions = Number(input.maxSuggestions || 8);
    this.generators = { ...(input.generators || {}) };
  }

  getGeneratorOptions(id, defaults = {}) {
    return {
      ...DEFAULT_GENERATOR_OPTIONS,
      ...(defaults || {}),
      ...(this.generators[String(id || '')] || {})
    };
  }

  toJSON() {
    return {
      enabled: this.enabled,
      version: this.version,
      strict: this.strict,
      voiceVerbosity: this.voiceVerbosity,
      chatVerbosity: this.chatVerbosity,
      suggestions: this.suggestions,
      maxVoiceLength: this.maxVoiceLength,
      maxChatLength: this.maxChatLength,
      maxNotificationLength: this.maxNotificationLength,
      maxParts: this.maxParts,
      maxSuggestions: this.maxSuggestions
    };
  }
}

module.exports = ResponseConfiguration;
