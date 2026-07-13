'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class PersonExtractor extends BaseEntityExtractor {
  extract(context) {
    const matches = this.text(context).match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g) || [];
    for (const value of matches) {
      if (!/^(OpenX|Chrome|Google|Microsoft|Windows|Desktop|Downloads|Documents|Pictures|Videos|Music|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i.test(value)) {
        this.addEntity(context, 'person', value, { confidence: 0.52, metadata: { kind: 'capitalized-name' } });
      }
    }
    return context;
  }
}

module.exports = PersonExtractor;
