'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class DurationExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'duration', /\b((?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|fifteen|twenty|thirty|sixty)\s*(?:seconds?|minutes?|hours?|secs?|mins?|hrs?))\b/gi, { confidence: 0.84 });
    return context;
  }
}

module.exports = DurationExtractor;
