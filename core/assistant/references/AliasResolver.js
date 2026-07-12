'use strict';

const DEFAULT_ALIASES = Object.freeze({
  browser: 'Google Chrome',
  editor: 'Visual Studio Code',
  music: 'Spotify'
});

class AliasResolver {
  constructor(options = {}) {
    this.id = String(options.id || 'reference.aliasResolver');
    this.priority = Number.isFinite(options.priority) ? options.priority : 80;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
    this.aliases = { ...DEFAULT_ALIASES, ...(options.aliases || {}) };
  }

  initialize() {
    this.initialized = true;
  }

  resolve(context) {
    const configured = { ...this.aliases, ...(context.configuration?.aliases || {}) };
    const text = String(context.input || '').toLowerCase();
    for (const [alias, target] of Object.entries(configured)) {
      if (new RegExp(`\\b${String(alias).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)) {
        const resolved = {
          alias,
          target,
          confidence: 0.65,
          source: this.id
        };
        context.resolvedAliases.push(resolved);
        context.resolvedReferences.push({ reference: alias, target, targetType: 'alias', confidence: 0.65, source: this.id });
      }
    }
    return context;
  }
}

module.exports = AliasResolver;
