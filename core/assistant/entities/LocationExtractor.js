'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class LocationExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'location', /\b(?:at|in|near)\s+(home|office|school|college|work|campus)\b/gi, { confidence: 0.68 });
    return context;
  }
}

module.exports = LocationExtractor;
