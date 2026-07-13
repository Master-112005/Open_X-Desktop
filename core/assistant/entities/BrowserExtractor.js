'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

const BROWSERS = Object.freeze({
  chrome: 'Google Chrome',
  'google chrome': 'Google Chrome',
  edge: 'Microsoft Edge',
  'microsoft edge': 'Microsoft Edge',
  firefox: 'Mozilla Firefox',
  browser: 'browser'
});

class BrowserExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addAliasMatches(context, 'browser', BROWSERS, { confidence: 0.86 });
    if (/\b(?:open|launch|start|search|browse)\s+(?:the\s+)?(?:web|internet|browser)\b/i.test(this.text(context))) {
      this.addEntity(context, 'browser', 'browser', { rawValue: 'browser', confidence: 0.6 });
    }
    return context;
  }
}

module.exports = BrowserExtractor;
