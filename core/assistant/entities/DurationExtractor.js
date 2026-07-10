'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class DurationExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'duration', /\b((?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|forty(?:\s*five)?|sixty)\s*(?:seconds?|minutes?|hours?|secs?|mins?|minits?|hrs?))\b/gi, { confidence: 0.84 });
    return context;
  }
}

module.exports = DurationExtractor;
