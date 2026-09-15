'use strict';

const { extractDiscourseReferences } = require('../linguistic/LanguageAnalysis');
const { deepFreeze } = require('../utils');

const DEFAULT_ALIASES = Object.freeze({
  browser: 'Google Chrome',
  editor: 'Visual Studio Code',
  music: 'Spotify'
});

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
    const references = extractDiscourseReferences(context.input || '');
    context.references = references.map(value => ({
      value,
      type: value.includes('file') || value.includes('app') || value.includes('folder') ? 'named-reference' : 'pronoun',
      resolved: null,
      confidence: 0
    }));
    return context;
  }
}

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

class ReferenceGraphBuilder {
  constructor(options = {}) {
    this.id = String(options.id || 'reference.graphBuilder');
    this.priority = Number.isFinite(options.priority) ? options.priority : 105;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
  }

  initialize() {
    this.initialized = true;
  }

  resolve(context) {
    context.futureExtensions.referenceGraph = deepFreeze({
      nodes: context.resolvedReferences.flatMap((item, index) => [
        { id: `reference:${index + 1}`, type: 'reference', value: item.reference || item.alias },
        { id: `target:${index + 1}`, type: item.targetType || 'target', value: item.target }
      ]),
      edges: context.resolvedReferences.map((item, index) => ({
        from: `reference:${index + 1}`,
        to: `target:${index + 1}`,
        confidence: item.confidence
      }))
    });
    return context;
  }
}

module.exports = {
  ReferenceResolver,
  PronounResolver,
  AliasResolver,
  ConversationResolver,
  ContextResolver,
  ReferenceGraphBuilder
};