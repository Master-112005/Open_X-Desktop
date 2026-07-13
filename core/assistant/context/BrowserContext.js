'use strict';

function compactText(value, maxLength = 180) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

function safeUrl(value) {
  const text = compactText(value, 500);
  if (!text) return null;
  return /^(https?:|file:|about:)/i.test(text) ? text : null;
}

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
    const browser = context.snapshots?.browser || {};
    const currentUrl = safeUrl(browser.currentUrl);
    const currentBrowser = compactText(browser.currentBrowser || context.workingMemory?.currentBrowser || '', 80) || null;
    const query = compactText(browser.query || browser.lastQuery || context.topic?.label || '', 180) || null;
    context.context.browserState = {
      currentBrowser,
      currentTab: compactText(browser.currentTab || '', 160) || null,
      currentUrl,
      currentWebsite: compactText(browser.currentWebsite || '', 120) || null,
      tabTitle: compactText(browser.tabTitle || browser.title || '', 160) || null,
      lastQuery: query,
      hasNavigablePage: Boolean(currentUrl),
      state: currentBrowser ? 'available' : 'unknown'
    };
    return context;
  }
}

module.exports = BrowserContext;
