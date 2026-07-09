'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');
const { FOLDER_ALIASES } = require('../entities.js');

class FolderExtractor extends BaseEntityExtractor {
  extract(context) {
    const text = this.normalized(context);
    for (const [alias, canonical] of Object.entries(FOLDER_ALIASES)) {
      if (new RegExp(`\\b${alias}\\b`).test(text)) {
        context.addEntity('folder', canonical, { rawValue: alias, source: this.id, confidence: 0.86 });
      }
    }
    this.addRegexMatches(context, 'folder', /\b(?:folder|directory)\s+(?:called|named)?\s*([^,.;]+?)(?=\s+(?:in|on|at|to|from)\b|$)/gi, { confidence: 0.62 });
    return context;
  }
}

module.exports = FolderExtractor;
