'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

class NetworkExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'network', /\b(wifi|wi-fi|wi fi|bluetooth|vpn|network|hotspot|ethernet|internet)\b/gi, { confidence: 0.75 });
    this.addRegexMatches(context, 'network', /\b(?:connect\s+to|disconnect\s+from|forget)\s+([A-Za-z0-9 _.-]{2,64})\s+(?:wifi|wi-fi|network|hotspot)\b/gi, { confidence: 0.68, metadata: { kind: 'network-name' } });
    return context;
  }
}

module.exports = NetworkExtractor;
