'use strict';

const DEFAULT_GENERATOR_OPTIONS = Object.freeze({ enabled: true, priority: 100 });

class ResponseConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || '11.0.0');
    this.strict = input.strict === true;
    this.chatVerbosity = String(input.chatVerbosity || 'concise');
    this.suggestions = input.suggestions !== false;
    this.responsePolicy = input.responsePolicy !== false;
    this.responseQuality = input.responseQuality !== false;
    this.confidenceDisclosureThreshold = Math.max(0, Math.min(1, Number(input.confidenceDisclosureThreshold ?? 0.6)));
    this.defaultDetailMode = String(input.defaultDetailMode || 'adaptive');
    this.proactiveSuggestions = input.proactiveSuggestions !== false;
    this.maxGeneratorMs = Math.max(1, Number(input.maxGeneratorMs || 75));
    this.personalityStyle = String(input.personalityStyle || input.tone || 'professional');
    this.preserveChatLineBreaks = input.preserveChatLineBreaks === true;
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
      chatVerbosity: this.chatVerbosity,
      suggestions: this.suggestions,
      responsePolicy: this.responsePolicy,
      responseQuality: this.responseQuality,
      confidenceDisclosureThreshold: this.confidenceDisclosureThreshold,
      defaultDetailMode: this.defaultDetailMode,
      proactiveSuggestions: this.proactiveSuggestions,
      maxGeneratorMs: this.maxGeneratorMs,
      personalityStyle: this.personalityStyle,
      preserveChatLineBreaks: this.preserveChatLineBreaks,
      maxChatLength: this.maxChatLength,
      maxNotificationLength: this.maxNotificationLength,
      maxParts: this.maxParts,
      maxSuggestions: this.maxSuggestions
    };
  }
}

module.exports = ResponseConfiguration;
