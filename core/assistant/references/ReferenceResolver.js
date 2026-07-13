'use strict';

const { extractDiscourseReferences } = require('../linguistic/LanguageAnalysis');

class ReferenceResolver {
  constructor(options = {}) {
    this.id = String(options.id || 'reference.resolver');
    this.priority = Number.isFinite(options.priority) ? options.priority : 60;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
  }

  initialize() {
    this.initialized = true;
  }

  resolve(context) {
    const references = extractDiscourseReferences(context.input || '');
    context.references = references.map(value => ({
      value,
      type: value.includes('file') || value.includes('app') || value.includes('folder') ? 'named-reference' : 'pronoun',
      resolved: null,
      confidence: 0
    }));
    return context;
  }
}

module.exports = ReferenceResolver;
