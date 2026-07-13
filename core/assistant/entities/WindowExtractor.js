'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class WindowExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'window', /\b(current window|active window|this window|that window|window)\b/gi, { confidence: 0.62 });
    this.addRegexMatches(context, 'window', /\b(?:close|minimize|maximize|restore|focus|switch\s+to)\s+(?:the\s+)?([A-Za-z][A-Za-z0-9 .'-]{1,60}?)(?:\s+window)?(?=$|[.?!])/gi, { confidence: 0.66 });
    return context;
  }
}

module.exports = WindowExtractor;
