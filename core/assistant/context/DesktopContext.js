'use strict';

function compactText(value, maxLength = 140) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

function compactList(items, limit = 12) {
  return (Array.isArray(items) ? items : [])
    .map(item => typeof item === 'string' ? item : item?.path || item?.name || item?.title || '')
    .map(item => compactText(item, 220))
    .filter(Boolean)
    .slice(0, limit);
}

class DesktopContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.desktop');
    this.priority = Number.isFinite(options.priority) ? options.priority : 120;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.maxItems = Number(options.maxItems || 12);
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    const snapshots = context.snapshots || {};
    const desktop = snapshots.desktop || {};
    context.context.desktopState = {
      path: compactText(desktop.path || desktop.desktopPath || '', 260) || null,
      workspace: compactText(desktop.workspace || desktop.currentWorkspace || '', 160) || null,
      openFolders: compactList(snapshots.openFolders || desktop.openFolders, this.maxItems),
      recentFiles: compactList(desktop.recentFiles || context.sessionMemory?.recentFiles, this.maxItems),
      itemCount: Number.isFinite(desktop.itemCount) ? desktop.itemCount : null,
      state: desktop.state || (snapshots.activeWindow ? 'active' : 'unknown')
    };
    return context;
  }
}

module.exports = DesktopContext;
