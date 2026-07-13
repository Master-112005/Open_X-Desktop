'use strict';

class BaseReasoner {
  constructor(options = {}) {
    this.id = String(options.id || this.constructor.name);
    this.name = String(options.name || this.id);
    this.priority = Number.isFinite(options.priority) ? Number(options.priority) : 100;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.options = { ...(options || {}) };
    this.initialized = false;
  }

  initialize() {
    this.initialized = true;
    return true;
  }

  supports(context) {
    return this.enabled && !!context;
  }

  reason(context) {
    return context;
  }

  cleanup() {
    return true;
  }

  text(context) {
    return String(context?.normalizedInput || context?.input || '').toLowerCase().trim();
  }

  hasAny(context, patterns = []) {
    const text = this.text(context);
    return patterns.some(pattern => pattern instanceof RegExp ? pattern.test(text) : text.includes(String(pattern).toLowerCase()));
  }

  entities(context, collection = null) {
    const structured = context?.structuredEntities || context?.metadata?.structuredEntities || context?.resolvedContext?.structuredEntities || null;
    if (!structured) return collection ? [] : {};
    if (collection) return Array.isArray(structured[collection]) ? structured[collection] : [];
    return structured;
  }

  bestEntity(context, collection) {
    return this.entities(context, collection).slice().sort((left, right) => (right.confidence || 0) - (left.confidence || 0))[0] || null;
  }

  entityValue(context, collection) {
    const entity = this.bestEntity(context, collection);
    return entity ? (entity.canonical || entity.value || null) : null;
  }

  confidence(value, fallback = 0.6) {
    return Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : fallback));
  }

  destroy() {
    this.initialized = false;
    return true;
  }
}

module.exports = BaseReasoner;
