'use strict';

const { Normalizer } = require('../Data');

class BaseEntityExtractor {
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

  extract(context) {
    return context;
  }

  validate(context) {
    return !!context;
  }

  cleanup() {
    return true;
  }

  destroy() {
    this.initialized = false;
    return true;
  }

  text(context) {
    return String(context?.text || context?.normalizedInput || '');
  }

  normalized(context) {
    return Normalizer.normalizeText(this.text(context));
  }

  addRegexMatches(context, type, regex, options = {}) {
    const source = options.normalized === true ? this.normalized(context) : this.text(context);
    let match;
    const pattern = regex.global ? regex : new RegExp(regex.source, `${regex.flags || ''}g`);
    while ((match = pattern.exec(source))) {
      const value = match[options.group || 1] || match[0];
      context.addEntity(type, value, {
        source: this.id,
        confidence: options.confidence ?? 0.7,
        metadata: options.metadata || {}
      });
    }
    return context;
  }
}

module.exports = BaseEntityExtractor;
