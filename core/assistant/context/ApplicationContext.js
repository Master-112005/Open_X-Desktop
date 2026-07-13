'use strict';

function compactText(value, maxLength = 120) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

function uniqueCompactList(items, limit) {
  return Array.from(new Set((Array.isArray(items) ? items : [])
    .map(item => typeof item === 'string' ? item : item?.name || item?.app || item?.title || '')
    .map(item => compactText(item, 80))
    .filter(Boolean))).slice(0, limit);
}

class ApplicationContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.application');
    this.priority = Number.isFinite(options.priority) ? options.priority : 110;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.reader = options.reader || null;
    this.maxApplications = Number(options.maxApplications || 20);
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  async collect(context) {
    const snapshots = context.snapshots || {};
    const activeWindow = this.reader ? await this.reader(context) : snapshots.activeWindow || null;
    const apps = uniqueCompactList(snapshots.runningApplications, this.maxApplications);
    const focusedApplication = compactText(activeWindow?.app || context.workingMemory?.currentApplication || '', 80) || null;
    context.context.runningApplications = apps;
    context.context.application = {
      focusedApplication,
      foregroundWindow: activeWindow ? {
        app: compactText(activeWindow.app || focusedApplication || '', 80),
        title: compactText(activeWindow.title || '', 160),
        handle: activeWindow.handle || null
      } : null,
      recentApplications: uniqueCompactList(context.sessionMemory?.recentApplications || [], this.maxApplications),
      applicationCount: apps.length,
      state: focusedApplication ? 'focused' : 'unknown'
    };
    return context;
  }
}

module.exports = ApplicationContext;
