'use strict';

const PRONOUNS = /\b(it|that|this|those|these|them|they|same one|previous one|last file|current app|selected folder)\b/gi;

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
    const found = new Set();
    let match;
    PRONOUNS.lastIndex = 0;
    while ((match = PRONOUNS.exec(context.input || ''))) {
      found.add(match[1].toLowerCase());
    }
    context.references = Array.from(found).map(value => ({
      value,
      type: value.includes('file') || value.includes('app') || value.includes('folder') ? 'named-reference' : 'pronoun',
      resolved: null,
      confidence: 0
    }));
    return context;
  }
}

module.exports = ReferenceResolver;
