'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class TimerExtractor extends BaseEntityExtractor {
  extract(context) {
    const match = this.text(context).match(/\b(?:set|start|create|begin|run)?\s*(?:a\s+)?(?:timer|countdown|pomodoro)\b(?:\s+(?:for|at|called|named)\s+([^,.;]+))?/i);
    if (match) this.addEntity(context, 'timer', match[1] || match[0], { confidence: 0.74, metadata: { kind: /\bpomodoro\b/i.test(match[0]) ? 'pomodoro' : 'timer' } });
    return context;
  }
}

module.exports = TimerExtractor;
