'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');
const { FOLDER_ALIASES } = require('./EntityExtractor');

class FolderExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addAliasMatches(context, 'folder', FOLDER_ALIASES, { confidence: 0.86 });
    this.addRegexMatches(context, 'folder', /\b(?:folder|directory)\s+(?:called|named)?\s*([^,.;]+?)(?=\s+(?:in|on|at|to|from)\b|$)/gi, { confidence: 0.62 });
    this.addRegexMatches(context, 'folder', /\b(?:open|show|create|make|delete|move|copy|backup|compress|extract|organize|clean)\s+(?:my\s+|the\s+|a\s+|an\s+)?([^,.;]+?)\s+(?:folder|directory|workspace)\b/gi, { confidence: 0.68 });
    this.addRegexMatches(context, 'folder', /\b(downloads|documents|desktop|pictures|videos|music|screenshots|recordings|projects|work|study|coding)\s+(?:folder|directory|workspace)\b/gi, { confidence: 0.72 });
    return context;
  }
}

module.exports = FolderExtractor;
