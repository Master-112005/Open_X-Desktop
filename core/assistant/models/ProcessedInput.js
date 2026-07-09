'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

class ProcessedInput {
  constructor({ raw = '', normalized = '', source = 'chat', metadata = {} } = {}) {
    this.raw = String(raw || '');
    this.normalized = String(normalized || raw || '');
    this.source = String(source || 'chat');
    this.metadata = { ...(metadata || {}) };
    deepFreeze(this);
  }
}

module.exports = ProcessedInput;
