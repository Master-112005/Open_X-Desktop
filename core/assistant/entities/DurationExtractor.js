'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class DurationExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'duration', /\b((?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty(?:\s*five)?|sixty)\s*(?:seconds?|minutes?|hours?|secs?|mins?|minits?|hrs?))\b/gi, { confidence: 0.84 });
    this.addRegexMatches(context, 'duration', /\b(half\s+an?\s+hour|quarter\s+hour|one\s+and\s+a\s+half\s+hours?)\b/gi, { confidence: 0.78 });
    this.addRegexMatches(context, 'duration', /\b(?:for|in|after)\s+(\d{1,3})\s*(?:m|h|s)\b/gi, { confidence: 0.66 });
    return context;
  }
}

module.exports = DurationExtractor;
