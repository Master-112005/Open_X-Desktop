'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class DeviceExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'device', /\b(phone|mobile|iphone|android|tablet|laptop|desktop|computer|speaker|microphone|camera|printer)\b/gi, { confidence: 0.78 });
    return context;
  }
}

module.exports = DeviceExtractor;
