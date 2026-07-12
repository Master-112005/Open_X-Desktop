'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class VolumeExtractor extends BaseEntityExtractor {
  extract(context) {
    const text = this.text(context);
    const match = text.match(/\b(?:volume|sound)\b.*?\b(\d{1,3})\s*%?\b/i) || text.match(/\b(\d{1,3})\s*%?\s+(?:volume|sound)\b/i);
    if (match) context.addEntity('volumeLevel', Math.min(100, Number(match[1])), { source: this.id, confidence: 0.85 });
    return context;
  }
}

module.exports = VolumeExtractor;
