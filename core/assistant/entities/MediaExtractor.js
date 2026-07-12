'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class MediaExtractor extends BaseEntityExtractor {
  extract(context) {
    const match = this.text(context).match(/\b(?:play|stream|listen to|watch)\s+(.+?)(?:\s+(?:on|in|via)\s+\w+)?$/i);
    if (match?.[1]) context.addEntity('media', match[1], { source: this.id, confidence: 0.7 });
    return context;
  }
}

module.exports = MediaExtractor;
