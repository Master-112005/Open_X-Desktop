'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class PersonExtractor extends BaseEntityExtractor {
  extract(context) {
    const matches = this.text(context).match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) || [];
    for (const value of matches) {
      if (!/^(OpenX|Chrome|Google|Microsoft|Windows)$/i.test(value)) {
        context.addEntity('person', value, { source: this.id, confidence: 0.5 });
      }
    }
    return context;
  }
}

module.exports = PersonExtractor;
