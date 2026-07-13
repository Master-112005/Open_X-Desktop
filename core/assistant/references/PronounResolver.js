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
    const target = this._selectTarget(context);
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

  _selectTarget(context) {
    const candidates = [
      ...(Array.isArray(context.entities) ? context.entities : []),
      ...(Array.isArray(context.conversationMemory?.references)
        ? context.conversationMemory.references.slice().reverse()
        : [])
    ].filter(Boolean);
    if (candidates.length === 0) return null;

    const text = String(context.input || '').toLowerCase();
    const preferredTypes = this._preferredTypesForInput(text);
    const exact = candidates.find(candidate => preferredTypes.includes(candidate.type));
    if (exact) return exact;

    return candidates.find(candidate =>
      ['application', 'browser', 'file', 'folder', 'website', 'media', 'window'].includes(candidate.type)
    ) || null;
  }

  _preferredTypesForInput(text) {
    if (/\b(?:send|share|transfer|copy|move|open|where|locat|file|folder|path)\b/.test(text)) {
      return ['file', 'folder', 'path'];
    }
    if (/\b(?:close|quit|exit|minimize|maximize|switch|focus|current\s+app|window)\b/.test(text)) {
      return ['application', 'window', 'browser'];
    }
    if (/\b(?:play|pause|resume|stop|skip|next|previous|song|music|video)\b/.test(text)) {
      return ['media', 'website', 'browser'];
    }
    if (/\b(?:open|search|go|there|website|site|tab|browser)\b/.test(text)) {
      return ['website', 'browser', 'application'];
    }
    return ['file', 'folder', 'application', 'browser', 'website', 'media', 'window'];
  }
}

module.exports = PronounResolver;
