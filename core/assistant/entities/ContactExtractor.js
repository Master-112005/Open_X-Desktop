'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class ContactExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'contact', /\b(?:call|message|text|reply\s+(?:to|for)|send(?:\s+\w+)?\s+to)\s+([A-Za-z][A-Za-z .'-]{1,60}?)(?=\s+(?:on|via|using|saying|that|with|about|to)\b|$)/gi, { confidence: 0.74 });
    this.addRegexMatches(context, 'contact', /\b(?:to|for)\s+([A-Z][A-Za-z .'-]{1,60}?)(?=\s+(?:saying|that|message|reply)\b|$)/g, { confidence: 0.62 });
    return context;
  }
}

module.exports = ContactExtractor;
