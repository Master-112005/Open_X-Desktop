'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class PathExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'path', /([A-Za-z]:\\[^\s"]+|\\\\[^\s"]+)/g, { confidence: 0.92 });
    this.addRegexMatches(context, 'path', /(?:^|\s)(~\/[^\s"]+|\/[^\s"]+)/g, { confidence: 0.78 });
    return context;
  }
}

module.exports = PathExtractor;
