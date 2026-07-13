'use strict';

const deepFreeze = require('../utils/ObjectFreeze');
const { sanitizeDetails } = require('../utils/ErrorHelpers');

function compactText(value, maxLength = 2000) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

function compactSuggestions(suggestions) {
  return (Array.isArray(suggestions) ? suggestions : [])
    .slice(0, 8)
    .map(item => ({
      ...sanitizeDetails(item || {}),
      text: compactText(item?.text || item?.label || '', 220)
    }))
    .filter(item => item.text);
}

class AssistantResponse {
  constructor(input = {}) {
    this.verificationResult = input.verificationResult || null;
    this.responseType = String(input.responseType || 'summary');
    this.formattedVoiceResponse = compactText(input.formattedVoiceResponse, 900);
    this.formattedChatResponse = compactText(input.formattedChatResponse, 2400);
    this.formattedNotification = compactText(input.formattedNotification, 180);
    this.suggestions = compactSuggestions(input.suggestions);
    this.diagnostics = sanitizeDetails(input.diagnostics || {});
    this.metadata = sanitizeDetails(input.metadata || {});
    this.timing = { ...(input.timing || {}) };
    this.version = String(input.version || '11.0.0');
    this.futureExtensions = sanitizeDetails(input.futureExtensions || {});
    deepFreeze(this);
  }
}

module.exports = AssistantResponse;
