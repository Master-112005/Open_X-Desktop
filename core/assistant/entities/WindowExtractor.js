'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class WindowExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'window', /\b(current window|active window|this window|that window|window)\b/gi, { confidence: 0.62 });
    return context;
  }
}

module.exports = WindowExtractor;
