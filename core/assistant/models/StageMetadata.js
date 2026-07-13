'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

class StageMetadata {
  constructor({ id = '', name = '', order = 0, enabled = true, tags = [], timeoutMs = 0, version = '1.0.0', requiredInputs = [] } = {}) {
    this.id = String(id || name || '');
    this.name = String(name || id || '');
    this.order = Number(order) || 0;
    this.enabled = enabled !== false;
    this.tags = Array.isArray(tags) ? tags.slice() : [];
    this.timeoutMs = Math.max(0, Number(timeoutMs) || 0);
    this.version = String(version || '1.0.0');
    this.requiredInputs = Array.isArray(requiredInputs) ? requiredInputs.map(String) : [];
    deepFreeze(this);
  }

  hasTag(tag) {
    return this.tags.includes(String(tag));
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      order: this.order,
      enabled: this.enabled,
      tags: this.tags,
      timeoutMs: this.timeoutMs,
      version: this.version,
      requiredInputs: this.requiredInputs
    };
  }
}

module.exports = StageMetadata;
