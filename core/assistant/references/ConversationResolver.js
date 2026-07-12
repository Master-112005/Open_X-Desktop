'use strict';

class ConversationResolver {
  constructor(options = {}) {
    this.id = String(options.id || 'reference.conversationResolver');
    this.priority = Number.isFinite(options.priority) ? options.priority : 90;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
  }

  initialize() {
    this.initialized = true;
  }

  resolve(context) {
    const namedRefs = context.references.filter(item => item.type === 'named-reference');
    for (const reference of namedRefs) {
      const lower = reference.value.toLowerCase();
      const target = lower.includes('app')
        ? context.workingMemory.currentApplication
        : lower.includes('file')
          ? context.workingMemory.currentFile
          : lower.includes('folder')
            ? context.workingMemory.currentSelection || context.workingMemory.currentFile
            : null;
      if (!target) continue;
      const resolved = {
        reference: reference.value,
        target,
        targetType: 'conversation-memory',
        confidence: 0.78,
        source: this.id
      };
      reference.resolved = resolved;
      reference.confidence = resolved.confidence;
      context.resolvedReferences.push(resolved);
    }
    return context;
  }
}

module.exports = ConversationResolver;
