'use strict';

const ResponseDiagnostics = require('./ResponseDiagnostics');
const AssistantResponse = require('./AssistantResponse');

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
    const part = { type, text: String(text || ''), data: { ...(data || {}) } };
    if (part.text) this.parts.push(part);
    return part;
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
      metadata: this.metadata,
      timing: this.timing,
      version: this.configuration?.version || '11.0.0',
      futureExtensions: this.futureExtensions
    });
  }
}

module.exports = ResponseContext;
