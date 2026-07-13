'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class FileExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'file', /(?:^|[\s"])([^\s"\\/]+\.[A-Za-z0-9]{1,10})(?=$|[\s"])/g, { confidence: 0.88, metadata: { kind: 'explicit-extension' } });
    this.addRegexMatches(context, 'file', /\b(?:file|document|pdf|spreadsheet|presentation|note|resume)\s+(?:called|named)?\s*([^,.;]+?)(?=\s+(?:in|on|at|to|from|into|with|using)\b|$)/gi, { confidence: 0.66 });
    this.addRegexMatches(context, 'file', /\b(?:open|show|delete|remove|move|copy|send|share|transfer|rename|backup|compress|extract)\s+(?:my\s+|the\s+|a\s+|an\s+|latest\s+|newest\s+|recent\s+)?([^,.;]+?)\s+(?:file|document|pdf|spreadsheet|presentation|note|resume)\b/gi, { confidence: 0.7 });
    this.addRegexMatches(context, 'file', /\b(?:latest|newest|recent|last)\s+((?:downloaded|created|modified)?\s*(?:file|document|pdf|screenshot|recording|image|video|audio))\b/gi, { confidence: 0.64, metadata: { relative: true } });
    return context;
  }
}

module.exports = FileExtractor;
