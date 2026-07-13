'use strict';

function compactText(value, maxLength = 240) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

function compactFiles(items, limit = 8) {
  return (Array.isArray(items) ? items : [])
    .map(item => typeof item === 'string'
      ? { path: compactText(item, 260), name: compactText(item.split(/[\\/]/).pop(), 120) }
      : {
          path: compactText(item?.path || item?.location || '', 260),
          name: compactText(item?.name || item?.title || '', 120)
        })
    .filter(item => item.path || item.name)
    .slice(0, limit);
}

class SelectionContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.selection');
    this.priority = Number.isFinite(options.priority) ? options.priority : 210;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    const selection = context.snapshots?.selection || {};
    const selectedText = compactText(selection.selectedText || selection.text || '', 240);
    const selectedFiles = compactFiles(selection.selectedFiles || selection.files || []);
    context.context.selections = {
      selectedText: selectedText || null,
      selectedFiles,
      selectedFile: selectedFiles[0] || null,
      selectionType: selectedFiles.length ? 'file' : selectedText ? 'text' : selection.type || 'none',
      sourceApplication: compactText(selection.sourceApplication || selection.app || '', 80) || null,
      hasSelection: Boolean(selectedText || selectedFiles.length)
    };
    return context;
  }
}

module.exports = SelectionContext;
