'use strict';

const deepFreeze = require('../utils/ObjectFreeze');
const { sanitizeDetails } = require('../utils/ErrorHelpers');

function tokenize(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).slice(0, 500);
}

class ProcessedInput {
  constructor({ raw = '', normalized = '', commandText = '', source = 'chat', metadata = {}, tokens = [] } = {}) {
    this.raw = String(raw || '');
    this.normalized = String(normalized || raw || '');
    this.commandText = String(commandText || metadata.commandIntentText || this.normalized).trim();
    this.source = String(source || 'chat');
    this.tokens = Array.isArray(tokens) && tokens.length ? tokens.slice(0, 500) : tokenize(this.commandText);
    this.metadata = sanitizeDetails(metadata || {});
    deepFreeze(this);
  }

  isEmpty() {
    return this.commandText.length === 0;
  }

  toJSON() {
    return {
      raw: this.raw,
      normalized: this.normalized,
      commandText: this.commandText,
      source: this.source,
      tokens: this.tokens,
      metadata: this.metadata
    };
  }
}

module.exports = ProcessedInput;
