'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class PathExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'path', /([A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*)/g, { confidence: 0.92 });
    this.addRegexMatches(context, 'path', /(["'])([A-Za-z]:\\[^"']+)\1/g, { group: 2, confidence: 0.94 });
    this.addRegexMatches(context, 'path', /(\\\\[^\s"]+)/g, { confidence: 0.9 });
    this.addRegexMatches(context, 'path', /(?:^|\s)(~\/[^\s"]+|\/[^\s"]+)/g, { confidence: 0.78 });
    this.addRegexMatches(context, 'path', /\b(?:in|from|to|into|under)\s+(desktop|downloads|documents|pictures|videos|music|home)\b/gi, { confidence: 0.68, metadata: { kind: 'known-folder-path' } });
    return context;
  }
}

module.exports = PathExtractor;
