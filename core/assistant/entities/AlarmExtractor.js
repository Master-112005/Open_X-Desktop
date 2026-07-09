'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class AlarmExtractor extends BaseEntityExtractor {
  extract(context) {
    const match = this.text(context).match(/\balarm\b(?:\s+(?:for|at)\s+([^,.;]+))?/i);
    if (match) context.addEntity('alarm', match[1] || match[0], { source: this.id, confidence: 0.72 });
    return context;
  }
}

module.exports = AlarmExtractor;
