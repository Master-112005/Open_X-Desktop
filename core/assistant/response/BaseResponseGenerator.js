'use strict';

class BaseResponseGenerator {
  constructor(options = {}) {
    this.id = String(options.id || this.constructor.name);
    this.name = String(options.name || this.id);
    this.priority = Number.isFinite(options.priority) ? Number(options.priority) : 100;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.options = { ...(options || {}) };
    this.initialized = false;
  }

  initialize() { this.initialized = true; return true; }
  supports(context) { return this.enabled && !!context; }
  generate(context) { return context; }
  cleanup() { return true; }
  destroy() { this.initialized = false; return true; }

  text(value, maxLength = 500) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
  }

  addPart(context, type, text, data = {}) {
    if (!context || typeof context.addPart !== 'function') return null;
    return context.addPart(type, this.text(text), data);
  }
}

module.exports = BaseResponseGenerator;
