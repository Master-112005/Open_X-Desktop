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
    const text = this.normalized(context);
    for (const [alias, canonical] of Object.entries(SITES)) {
      if (new RegExp(`\\b${alias}\\b`).test(text)) {
        context.addEntity('website', canonical, { rawValue: alias, source: this.id, confidence: 0.8 });
      }
    }
    return context;
  }
}

module.exports = WebsiteExtractor;
