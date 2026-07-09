'use strict';

const RELATIVE_DATES = /^(?:today|tomorrow|tonight|next\s+(?:week|month)|(?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))$/i;
const NATURAL_DATES = /^(?:(?:this|next)\s+month\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}(?:st|nd|rd|th)?(?:\s+(?:of\s+)?(?:this|next)\s+month|\s+(?:this|next)\s+month)|\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+(?:\d{2,4}|(?:of\s+)?(?:this|next)\s+year))?|\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:,?\s+(?:\d{2,4}|(?:of\s+)?(?:this|next)\s+year))?)$/i;

function normalizeList(values) {
  return new Set((Array.isArray(values) ? values : []).map(value => String(value || '').toLowerCase().trim()).filter(Boolean));
}

class EntityValidator {
  constructor(options = {}) {
    this.id = options.id || 'entity.validator';
    this.priority = Number.isFinite(options.priority) ? options.priority : 1020;
    this.providers = { ...(options.providers || {}) };
    this.knownApplications = normalizeList(this.providers.installedApplications || this.providers.applications);
    this.knownBrowsers = normalizeList(this.providers.browsers || ['Google Chrome', 'Microsoft Edge', 'Mozilla Firefox']);
  }

  process(context) {
    const seen = new Set();
    const status = { valid: true, entityCount: 0, issueCount: 0 };
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
      if (entity.type === 'date' && !RELATIVE_DATES.test(entity.value) && !NATURAL_DATES.test(entity.value) && Number.isNaN(Date.parse(entity.value))) {
        issues.push('invalid-date');
      }
      if (entity.type === 'application' && this.knownApplications.size > 0 && !this.knownApplications.has(String(entity.canonical || entity.value).toLowerCase())) {
        issues.push('unknown-application');
        context.diagnostics.unknownEntities.push({ type: entity.type, value: entity.value });
      }
      if (entity.type === 'browser' && !this.knownBrowsers.has(String(entity.canonical || entity.value).toLowerCase())) {
        issues.push('unknown-browser');
        context.diagnostics.unknownEntities.push({ type: entity.type, value: entity.value });
      }
      entity.validation = {
        valid: issues.length === 0,
        issues
      };
      status.entityCount += 1;
      status.issueCount += issues.length;
      if (issues.length > 0) status.valid = false;
    }
    context.diagnostics.validation = status;
    return context;
  }
}

module.exports = EntityValidator;
