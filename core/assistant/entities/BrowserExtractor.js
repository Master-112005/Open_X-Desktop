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
    const text = this.normalized(context);
    for (const [alias, canonical] of Object.entries(BROWSERS)) {
      if (new RegExp(`\\b${alias}\\b`).test(text)) {
        context.addEntity('browser', canonical, { rawValue: alias, source: this.id, confidence: alias === 'browser' ? 0.55 : 0.86 });
      }
    }
    return context;
  }
}

module.exports = BrowserExtractor;
