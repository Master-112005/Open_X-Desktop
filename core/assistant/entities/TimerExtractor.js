'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class TimerExtractor extends BaseEntityExtractor {
  extract(context) {
    const match = this.text(context).match(/\btimer\b(?:\s+(?:for|at)\s+([^,.;]+))?/i);
    if (match) context.addEntity('timer', match[1] || match[0], { source: this.id, confidence: 0.72 });
    return context;
  }
}

module.exports = TimerExtractor;
