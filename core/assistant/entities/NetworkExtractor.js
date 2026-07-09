'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class NetworkExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'network', /\b(wifi|wi-fi|bluetooth|vpn|network|hotspot)\b/gi, { confidence: 0.75 });
    return context;
  }
}

module.exports = NetworkExtractor;
