'use strict';

const BaseEntityExtractor = require('./BaseEntityExtractor');

const SITES = Object.freeze({
  yt: 'YouTube',
  youtube: 'YouTube',
  google: 'Google',
  github: 'GitHub',
  gmail: 'Gmail',
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
  amazon: 'Amazon',
  netflix: 'Netflix'
});

class WebsiteExtractor extends BaseEntityExtractor {
  extract(context) {
    this.addRegexMatches(context, 'website', /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/\S*)?/g, { confidence: 0.9 });
    this.addAliasMatches(context, 'website', SITES, { confidence: 0.8 });
    this.addRegexMatches(context, 'website', /\b(?:open|search|browse|go\s+to)\s+([A-Za-z0-9.-]+\.[A-Za-z]{2,})(?:\s|$)/gi, { confidence: 0.86 });
    return context;
  }
}

module.exports = WebsiteExtractor;
