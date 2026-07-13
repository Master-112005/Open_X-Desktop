'use strict';

const ResponseDiagnostics = require('./ResponseDiagnostics');
const AssistantResponse = require('./AssistantResponse');
const { sanitizeDetails } = require('../utils/ErrorHelpers');

function compactText(value, maxLength = 1000) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

class ResponseContext {
  constructor({ verificationResult = null, configuration = null, metadata = {} } = {}) {
    this.verificationResult = verificationResult || null;
    this.configuration = configuration || null;
    this.metadata = { ...(metadata || {}) };
    this.responseType = 'summary';
    this.parts = [];
    this.suggestions = [];
    this.formattedVoiceResponse = '';
    this.formattedChatResponse = '';
    this.formattedNotification = '';
    this.diagnostics = new ResponseDiagnostics();
    this.timing = { startedAt: Date.now(), finishedAt: null, durationMs: 0 };
    this.futureExtensions = {};
  }

  addPart(type, text, data = {}) {
    const part = {
      type: String(type || 'summary'),
      text: compactText(text, 1000),
      data: sanitizeDetails(data || {})
    };
    if (part.text) {
      this.parts.push(part);
      const maxParts = Number(this.configuration?.maxParts || 20);
      if (this.parts.length > maxParts) this.parts.splice(0, this.parts.length - maxParts);
    }
    return part;
  }

  addSuggestion(type, text, data = {}) {
    const suggestion = {
      type: String(type || 'suggestion'),
      text: compactText(text, 220),
      ...sanitizeDetails(data || {})
    };
    if (suggestion.text) {
      this.suggestions.push(suggestion);
      const maxSuggestions = Number(this.configuration?.maxSuggestions || 8);
      if (this.suggestions.length > maxSuggestions) this.suggestions.splice(0, this.suggestions.length - maxSuggestions);
    }
    return suggestion;
  }

  baseText() {
    return this.parts.map(part => part.text).filter(Boolean).join(' ');
  }

  toAssistantResponse() {
    this.timing.finishedAt = this.timing.finishedAt || Date.now();
    this.timing.durationMs = Math.max(0, this.timing.finishedAt - this.timing.startedAt);
    return new AssistantResponse({
      verificationResult: this.verificationResult,
      responseType: this.responseType,
      formattedVoiceResponse: this.formattedVoiceResponse,
      formattedChatResponse: this.formattedChatResponse,
      formattedNotification: this.formattedNotification,
      suggestions: this.suggestions,
      diagnostics: this.diagnostics.toJSON(),
      metadata: sanitizeDetails(this.metadata),
      timing: this.timing,
      version: this.configuration?.version || '11.0.0',
      futureExtensions: sanitizeDetails(this.futureExtensions)
    });
  }
}

module.exports = ResponseContext;
