'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class VolumeExtractor extends BaseEntityExtractor {
  extract(context) {
    const text = this.text(context);
    const match = text.match(/\b(?:volume|sound|vol)\b.*?\b(\d{1,3})\s*%?\b/i)
      || text.match(/\b(?:set\s+it\s+to|set\s+to|to)\s*(\d{1,3})\s*%?\b/i)
      || text.match(/\b(\d{1,3})\s*%?\s+(?:volume|sound|vol)\b/i);
    if (match) this.addEntity(context, 'volumeLevel', Math.min(100, Number(match[1])), { confidence: 0.86, metadata: { control: 'volume' } });
    if (/\b(?:max|maximum|full)\s+(?:volume|sound|vol)\b/i.test(text)) this.addEntity(context, 'volumeLevel', 100, { confidence: 0.82, metadata: { control: 'volume' } });
    if (/\b(?:mute|minimum|zero)\s+(?:volume|sound|vol)?\b/i.test(text)) this.addEntity(context, 'volumeLevel', 0, { confidence: 0.78, metadata: { control: 'volume' } });
    return context;
  }
}

module.exports = VolumeExtractor;
