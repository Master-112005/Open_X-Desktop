'use strict';

class ContextResolver {
  constructor(options = {}) {
    this.id = String(options.id || 'reference.contextResolver');
    this.priority = Number.isFinite(options.priority) ? options.priority : 100;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
  }

  initialize() {
    this.initialized = true;
  }

  resolve(context) {
    const windowTarget = context.snapshots.activeWindow?.app || context.snapshots.activeWindow?.title || null;
    if (!windowTarget) return context;
    for (const reference of context.references.filter(item => !item.resolved && /^(it|that|this|current app)$/.test(item.value))) {
      const resolved = {
        reference: reference.value,
        target: windowTarget,
        targetType: 'active-window',
        confidence: 0.7,
        source: this.id
      };
      reference.resolved = resolved;
      reference.confidence = resolved.confidence;
      context.resolvedReferences.push(resolved);
    }
    return context;
  }
}

module.exports = ContextResolver;
