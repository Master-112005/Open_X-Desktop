'use strict';

const BaseCandidateFilter = require('./BaseCandidateFilter');
const { FILTER_IDS } = require('./CandidateContracts');
const { candidateText, containsAny, getConstraintValues, normalize } = require('./filter-utils');

class ScreenshotFilter extends BaseCandidateFilter {
  constructor(options = {}) {
    super({ ...options, id: FILTER_IDS.SCREENSHOT });
  }

  supports(visualQuery) {
    const values = getConstraintValues(visualQuery, ['media', 'photoTypes', 'sourceApps']).map(normalize);
    return values.includes('screenshot') || values.some(value => ['whatsapp', 'instagram', 'bank', 'paytm', 'phonepe', 'google pay'].includes(value));
  }

  apply(pool, visualQuery) {
    const values = getConstraintValues(visualQuery, ['sourceApps']);
    return pool.applyFilter(this.id, candidate => {
      const text = candidateText(candidate, ['folder', 'fileName', 'filePath', 'photoType']);
      const screenshot = /screen\s*shot|screenshot|captures?|snip/i.test(text);
      const sourceMatched = values.length === 0 || containsAny(text, values) || containsAny(candidate.metadata?.sourceApp || '', values);
      const matched = screenshot && sourceMatched;
      return { passed: matched, confidence: matched ? 0.86 : 0.2, reason: matched ? 'screenshot signals matched' : 'screenshot signals missing' };
    });
  }
}

module.exports = ScreenshotFilter;
