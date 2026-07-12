'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class TimeExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'time', /\b(?:at\s+)?(\d{1,2}(?:(?::|\s+)\d{2})?\s*(?:am|pm))\b/gi, { confidence: 0.86 });
    this.addRegexMatches(context, 'time', /\b(?:at\s+)?((?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(?:am|pm))\b/gi, { confidence: 0.82 });
    this.addRegexMatches(context, 'time', /\b((?:half|quarter)\s+(?:past|to)\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve))\b/gi, { confidence: 0.76 });
    this.addRegexMatches(context, 'time', /\b(noon|midnight|morning|afternoon|evening|night)\b/gi, { confidence: 0.62 });
    return context;
  }
}

module.exports = TimeExtractor;
