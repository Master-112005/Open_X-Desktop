'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

class AssistantResponse {
  constructor(input = {}) {
    this.verificationResult = input.verificationResult || null;
    this.responseType = String(input.responseType || 'summary');
    this.formattedVoiceResponse = String(input.formattedVoiceResponse || '');
    this.formattedChatResponse = String(input.formattedChatResponse || '');
    this.formattedNotification = String(input.formattedNotification || '');
    this.suggestions = Array.isArray(input.suggestions) ? input.suggestions.slice() : [];
    this.diagnostics = input.diagnostics || {};
    this.metadata = { ...(input.metadata || {}) };
    this.timing = { ...(input.timing || {}) };
    this.version = String(input.version || '11.0.0');
    this.futureExtensions = { ...(input.futureExtensions || {}) };
    deepFreeze(this);
  }
}

module.exports = AssistantResponse;
