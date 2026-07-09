'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

class StageMetadata {
  constructor({ id = '', name = '', order = 0, enabled = true, tags = [] } = {}) {
    this.id = String(id || name || '');
    this.name = String(name || id || '');
    this.order = Number(order) || 0;
    this.enabled = enabled !== false;
    this.tags = Array.isArray(tags) ? tags.slice() : [];
    deepFreeze(this);
  }
}

module.exports = StageMetadata;
