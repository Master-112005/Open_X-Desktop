'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class ContactExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'contact', /\b(?:call|message|text|send(?:\s+\w+)?\s+to)\s+([A-Za-z][A-Za-z .'-]{1,60}?)(?=\s+(?:on|via|using|saying|that|to)\b|$)/gi, { confidence: 0.72 });
    return context;
  }
}

module.exports = ContactExtractor;
