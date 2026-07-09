'use strict';

class PronounResolver {
  constructor(options = {}) {
    this.id = String(options.id || 'reference.pronounResolver');
    this.priority = Number.isFinite(options.priority) ? options.priority : 70;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
  }

  initialize() {
    this.initialized = true;
  }

  resolve(context) {
    const target = context.latestEntity(['application', 'browser', 'file', 'folder', 'website', 'media']) ||
      context.conversationMemory.references?.slice().reverse().find(Boolean) ||
      null;
    if (!target) return context;

    for (const reference of context.references.filter(item => item.type === 'pronoun')) {
      const resolved = {
        reference: reference.value,
        target: target.canonical || target.value,
        targetType: target.type,
        confidence: Math.min(0.82, Number(target.confidence || 0.7)),
        source: this.id
      };
      reference.resolved = resolved;
      reference.confidence = resolved.confidence;
      context.resolvedPronouns.push(resolved);
      context.resolvedReferences.push(resolved);
    }
    return context;
  }
}

module.exports = PronounResolver;
