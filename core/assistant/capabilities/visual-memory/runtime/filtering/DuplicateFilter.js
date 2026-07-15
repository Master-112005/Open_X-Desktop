'use strict';

const BaseCandidateFilter = require('./BaseCandidateFilter');
const { FILTER_IDS } = require('./CandidateContracts');

class DuplicateFilter extends BaseCandidateFilter {
  constructor(options = {}) {
    super({ ...options, id: FILTER_IDS.DUPLICATE });
  }

  apply(pool) {
    const seen = new Set();
    return pool.applyFilter(this.id, candidate => {
      const key = String(candidate.metadata?.fileHash || candidate.photo?.fileHash || candidate.path || candidate.photoId || '').toLowerCase();
      if (!key) return { passed: true, confidence: 0.5, reason: 'no duplicate key' };
      if (seen.has(key)) return { passed: false, confidence: 0.9, reason: 'duplicate candidate' };
      seen.add(key);
      return { passed: true, confidence: 0.72, reason: 'unique candidate' };
    });
  }
}

module.exports = DuplicateFilter;
