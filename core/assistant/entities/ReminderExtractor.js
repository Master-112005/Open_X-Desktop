'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class ReminderExtractor extends BaseEntityExtractor {
  extract(context) {
    const match = this.text(context).match(/\b(?:remind|reminder|notify|alert)\b(?:.+?\bto\s+(.+))?/i);
    if (match) context.addEntity('reminder', match[1] || match[0], { source: this.id, confidence: 0.7 });
    return context;
  }
}

module.exports = ReminderExtractor;
