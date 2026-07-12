'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class FileExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'file', /(?:^|[\s"])([^\s"\\/]+\.[A-Za-z0-9]{1,10})(?=$|[\s"])/g, { confidence: 0.85 });
    this.addRegexMatches(context, 'file', /\b(?:file|document)\s+(?:called|named)?\s*([^,.;]+?)(?=\s+(?:in|on|at|to|from)\b|$)/gi, { confidence: 0.65 });
    this.addRegexMatches(context, 'file', /\b(?:open|show|delete|move|copy|send)\s+(?:my\s+|the\s+|a\s+|an\s+)?([^,.;]+?)\s+(?:file|document)\b/gi, { confidence: 0.68 });
    return context;
  }
}

module.exports = FileExtractor;
