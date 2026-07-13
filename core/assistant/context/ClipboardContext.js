'use strict';

function compactText(value, maxLength = 220) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

function list(items, limit = 5) {
  return (Array.isArray(items) ? items : [])
    .map(item => compactText(typeof item === 'string' ? item : item?.path || item?.name || item?.text || '', 220))
    .filter(Boolean)
    .slice(0, limit);
}

class ClipboardContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.clipboard');
    this.priority = Number.isFinite(options.priority) ? options.priority : 150;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.maxPreview = Number(options.maxPreview || 220);
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    const clipboard = context.snapshots?.clipboard || {};
    const text = compactText(clipboard.text || clipboard.selectedText || clipboard.preview || '', this.maxPreview);
    const files = list(clipboard.files || clipboard.paths || [], 8);
    context.context.clipboard = {
      type: clipboard.type || (files.length ? 'files' : text ? 'text' : 'empty'),
      textPreview: text || null,
      files,
      hasText: Boolean(text),
      hasFiles: files.length > 0,
      updatedAt: clipboard.updatedAt || null
    };
    return context;
  }
}

module.exports = ClipboardContext;
