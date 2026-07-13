'use strict';

function compactText(value, maxLength = 160) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

function compactWindow(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    title: compactText(value.title || '', 180) || null,
    app: compactText(value.app || value.process || '', 80) || null,
    handle: value.handle || null,
    fullscreen: Boolean(value.fullscreen),
    minimized: Boolean(value.minimized)
  };
}

class WindowContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.window');
    this.priority = Number.isFinite(options.priority) ? options.priority : 220;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.maxWindows = Number(options.maxWindows || 10);
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    const snapshots = context.snapshots || {};
    const activeWindow = compactWindow(snapshots.activeWindow);
    const openWindows = (Array.isArray(snapshots.openWindows) ? snapshots.openWindows : [])
      .map(compactWindow)
      .filter(Boolean)
      .slice(0, this.maxWindows);
    context.context.windows = {
      focusedWindow: activeWindow,
      title: activeWindow?.title || null,
      handle: activeWindow?.handle || null,
      openWindows,
      openWindowCount: openWindows.length,
      state: activeWindow?.fullscreen ? 'fullscreen' : activeWindow ? 'focused' : 'unknown'
    };
    return context;
  }
}

module.exports = WindowContext;
