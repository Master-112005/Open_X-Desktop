'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');
const { FOLDER_ALIASES } = require('./EntityExtractor');

class FolderExtractor extends BaseEntityExtractor {
  extract(context) {
    const text = this.normalized(context);
    for (const [alias, canonical] of Object.entries(FOLDER_ALIASES)) {
      if (new RegExp(`\\b${alias}\\b`).test(text)) {
        context.addEntity('folder', canonical, { rawValue: alias, source: this.id, confidence: 0.86 });
      }
    }
    this.addRegexMatches(context, 'folder', /\b(?:folder|directory)\s+(?:called|named)?\s*([^,.;]+?)(?=\s+(?:in|on|at|to|from)\b|$)/gi, { confidence: 0.62 });
    this.addRegexMatches(context, 'folder', /\b(?:open|show|create|make|delete|move|copy)\s+(?:my\s+|the\s+|a\s+|an\s+)?([^,.;]+?)\s+(?:folder|directory)\b/gi, { confidence: 0.68 });
    return context;
  }
}

module.exports = FolderExtractor;
