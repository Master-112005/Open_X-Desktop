'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class DeviceExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'device', /\b(phone|mobile|iphone|android|tablet|laptop|desktop|computer|pc|speaker|camera|printer|headphones?|earbuds?|keyboard|mouse)\b/gi, { confidence: 0.78 });
    this.addRegexMatches(context, 'device', /\b(?:my|this|that|connected)\s+(device|phone|laptop|computer|pc)\b/gi, { confidence: 0.7 });
    return context;
  }
}

module.exports = DeviceExtractor;
