'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');
const { APP_ALIASES } = require('./EntityExtractor');

class ApplicationExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addAliasMatches(context, 'application', APP_ALIASES, { confidence: 0.82 });
    this.addRegexMatches(context, 'application', /\b(?:open|launch|start|run|close|quit|switch\s+to|focus)\s+(?:the\s+)?([A-Za-z][A-Za-z0-9 .+-]{1,60}?)(?=\s+(?:app|application|program|window)\b|$)/gi, { confidence: 0.64 });
    return context;
  }
}

module.exports = ApplicationExtractor;
