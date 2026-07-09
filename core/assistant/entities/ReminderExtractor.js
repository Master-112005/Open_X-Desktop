'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class ReminderExtractor extends BaseEntityExtractor {
  extract(context) {
    const text = this.text(context);
    const match = text.match(/\b(?:remind|reminder|notify|alert)\b(?:.+?\b(?:to|say|about|that)\s+(.+))?/i);
    if (!match) return context;
    const value = String(match[1] || match[0] || '').replace(/[.?!]+$/g, '').trim();
    if (value) context.addEntity('reminder', value, { source: this.id, confidence: match[1] ? 0.78 : 0.7 });
    return context;
  }
}

module.exports = ReminderExtractor;
