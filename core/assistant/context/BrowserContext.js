'use strict';

class BrowserContext {
  constructor(options = {}) {
    this.id = String(options.id || 'context.browser');
    this.priority = Number.isFinite(options.priority) ? options.priority : 130;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
  }

  initialize() { this.initialized = true; }

  collect(context) {
    const browser = context.snapshots.browser || {};
    context.context.browserState = {
      currentBrowser: browser.currentBrowser || context.workingMemory.currentBrowser || null,
      currentTab: browser.currentTab || null,
      currentUrl: browser.currentUrl || null,
      currentWebsite: browser.currentWebsite || null,
      tabTitle: browser.tabTitle || null
    };
    return context;
  }
}

module.exports = BrowserContext;
