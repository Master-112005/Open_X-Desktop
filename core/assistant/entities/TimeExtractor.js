'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class TimeExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'time', /\b(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/gi, { confidence: 0.86 });
    this.addRegexMatches(context, 'time', /\b(noon|midnight|morning|afternoon|evening|night)\b/gi, { confidence: 0.62 });
    return context;
  }
}

module.exports = TimeExtractor;
