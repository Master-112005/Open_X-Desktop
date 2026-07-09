'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');
const { APP_ALIASES } = require('../entities.js');

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

class ApplicationExtractor extends BaseEntityExtractor {
  extract(context) {
    const text = this.normalized(context);
    for (const [alias, canonical] of Object.entries(APP_ALIASES)) {
      if (new RegExp(`\\b${escapeRegex(alias)}\\b`).test(text)) {
        context.addEntity('application', canonical, { rawValue: alias, source: this.id, confidence: 0.82 });
      }
    }
    return context;
  }
}

module.exports = ApplicationExtractor;
