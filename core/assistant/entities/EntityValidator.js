'use strict';

class EntityValidator {
  constructor(options = {}) {
    this.id = options.id || 'entity.validator';
    this.priority = Number.isFinite(options.priority) ? options.priority : 1020;
  }

  process(context) {
    const seen = new Set();
    for (const entity of context.allEntities()) {
      const key = `${entity.type}:${String(entity.canonical || entity.value).toLowerCase()}`;
      const issues = [];
      if (!entity.value) issues.push('missing-value');
      if (seen.has(key)) {
        issues.push('duplicate-entity');
        context.diagnostics.duplicateEntities.push({ type: entity.type, value: entity.value });
      }
      seen.add(key);
      if (entity.type === 'path' && !/^[A-Za-z]:\\|^\\\\|^~|^\//.test(entity.value)) {
        issues.push('unverified-path');
      }
      entity.validation = {
        valid: issues.length === 0,
        issues
      };
    }
    return context;
  }
}

module.exports = EntityValidator;
