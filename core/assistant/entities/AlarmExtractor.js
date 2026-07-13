'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class AlarmExtractor extends BaseEntityExtractor {
  extract(context) {
    const match = this.text(context).match(/\b(?:set|create|add)?\s*(?:an?\s+)?alarm\b(?:\s+(?:for|at|called|named|label(?:\s+it)?)\s+([^,.;]+))?/i)
      || this.text(context).match(/\bwake\s+me\s+(?:up\s+)?(?:at|by|before)\s+([^,.;]+)/i);
    if (match) this.addEntity(context, 'alarm', match[1] || match[0], { confidence: 0.74, metadata: { kind: 'alarm' } });
    return context;
  }
}

module.exports = AlarmExtractor;
