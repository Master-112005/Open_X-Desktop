'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class LocationExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'location', /\b(?:at|in|near|when\s+i\s+(?:reach|arrive\s+at|leave))\s+(home|office|school|college|work|campus|airport|station|store|gym|library)\b/gi, { confidence: 0.68 });
    this.addRegexMatches(context, 'location', /\b(?:nearby|near\s+me|around\s+me)\b/gi, { confidence: 0.64, metadata: { relative: true } });
    return context;
  }
}

module.exports = LocationExtractor;
