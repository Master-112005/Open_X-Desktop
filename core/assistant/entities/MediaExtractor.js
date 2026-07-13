'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class MediaExtractor extends BaseEntityExtractor {
  extract(context) {
    const match = this.text(context).match(/\b(?:play|stream|listen to|watch|queue|start playing)\s+(.+?)(?:\s+(?:on|in|via)\s+(?:youtube|spotify|soundcloud|apple music|amazon music|jiosaavn|gaana))?$/i);
    if (match?.[1]) {
      const value = match[1]
        .replace(/\b(?:song|songs|music|track|tracks|video|videos)\b\s*$/i, '')
        .trim();
      this.addEntity(context, 'media', value || match[1], { confidence: 0.74, metadata: { kind: 'media-query' } });
    }
    this.addRegexMatches(context, 'media', /\b(?:playlist|album|artist|podcast|audiobook)\s+(?:called|named)?\s*([^,.;]+)$/gi, { confidence: 0.66 });
    return context;
  }
}

module.exports = MediaExtractor;
