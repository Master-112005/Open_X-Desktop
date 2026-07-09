'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

class AssistantResponse {
  constructor({ success = false, response = '', result = null, metadata = {} } = {}) {
    this.success = success === true;
    this.response = String(response || result?.response || '');
    this.result = result;
    this.metadata = { ...(metadata || {}) };
    deepFreeze(this);
  }
}

module.exports = AssistantResponse;
