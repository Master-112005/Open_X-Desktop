'use strict';

const BaseMemoryProvider = require('./BaseMemoryProvider');

class WorkingMemory extends BaseMemoryProvider {
  apply(context) {
    const now = Date.now();
    const ttlMs = Number(this.options.ttlMs || context.configuration?.workingMemoryTtlMs || 30 * 60 * 1000);
    const store = context.state.workingMemory || { values: {}, updatedAt: now };
    if (now - Number(store.updatedAt || 0) > ttlMs) {
      store.values = {};
    }

    const app = context.latestEntity(['application']);
    const file = context.latestEntity(['file', 'path']);
    const browser = context.latestEntity(['browser']);
    const selection = context.snapshots.selection || null;
    if (app) store.values.currentApplication = app.canonical || app.value;
    if (file) store.values.currentFile = file.canonical || file.value;
    if (browser) store.values.currentBrowser = browser.canonical || browser.value;
    if (selection) store.values.currentSelection = selection;
    store.values.currentCommand = context.input || store.values.currentCommand || '';
    store.values.currentSource = context.metadata.source || store.values.currentSource || 'chat';
    store.values.lastEntityTypes = context.entities.map(entity => entity.type).slice(-10);
    store.updatedAt = now;
    context.state.workingMemory = store;
    context.workingMemory = {
      ...store.values,
      updatedAt: store.updatedAt,
      expiresAt: store.updatedAt + ttlMs
    };
    return context;
  }
}

module.exports = WorkingMemory;
