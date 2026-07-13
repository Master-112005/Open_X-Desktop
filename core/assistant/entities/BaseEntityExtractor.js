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

  escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  cleanValue(value) {
    return String(value || '')
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  sourceMetadata(match, source, options = {}) {
    const value = match?.[options.group || 1] || match?.[0] || '';
    return {
      ...(options.metadata || {}),
      index: Number.isFinite(match?.index) ? match.index : null,
      length: String(match?.[0] || value).length,
      extractor: this.id,
      normalizedSource: options.normalized === true,
      sourceText: options.includeSourceText === true ? source : undefined
    };
  }

  addEntity(context, type, value, options = {}) {
    const cleaned = this.cleanValue(value);
    if (!cleaned) return null;
    const confidence = options.confidence ?? 0.7;
    const threshold = Number(this.options.confidenceThreshold ?? context?.configuration?.confidenceThreshold ?? 0);
    if (confidence < threshold) return null;
    return context.addEntity(type, cleaned, {
      rawValue: options.rawValue || value,
      canonical: options.canonical,
      source: this.id,
      confidence,
      metadata: { ...(options.metadata || {}) }
    });
  }

  addAliasMatches(context, type, aliases = {}, options = {}) {
    const source = options.normalized === false ? this.text(context) : this.normalized(context);
    for (const [alias, canonical] of Object.entries(aliases || {})) {
      const pattern = new RegExp(`\\b${this.escapeRegex(alias)}\\b`, 'i');
      const match = source.match(pattern);
      if (match) {
        this.addEntity(context, type, canonical, {
          rawValue: alias,
          canonical,
          confidence: options.confidence ?? 0.82,
          metadata: {
            alias,
            ...this.sourceMetadata(match, source, options),
            ...(options.metadata || {})
          }
        });
      }
    }
    return context;
  }

  addRegexMatches(context, type, regex, options = {}) {
    const source = options.normalized === true ? this.normalized(context) : this.text(context);
    let match;
    const pattern = regex.global ? regex : new RegExp(regex.source, `${regex.flags || ''}g`);
    pattern.lastIndex = 0;
    while ((match = pattern.exec(source))) {
      const value = match[options.group || 1] || match[0];
      const confidence = options.confidence ?? 0.7;
      const threshold = Number(this.options.confidenceThreshold ?? context?.configuration?.confidenceThreshold ?? 0);
      const zeroLength = match[0] === '';
      if (confidence < threshold) {
        if (zeroLength) pattern.lastIndex += 1;
        continue;
      }
      this.addEntity(context, type, value, {
        rawValue: value,
        confidence,
        metadata: this.sourceMetadata(match, source, options)
      });
      if (zeroLength) pattern.lastIndex += 1;
    }
    return context;
  }
}

module.exports = BaseEntityExtractor;
