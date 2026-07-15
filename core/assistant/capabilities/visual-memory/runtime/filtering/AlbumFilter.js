'use strict';

const BaseCandidateFilter = require('./BaseCandidateFilter');
const { FILTER_IDS } = require('./CandidateContracts');
const { candidateText, containsAny, getConstraintValues } = require('./filter-utils');

class AlbumFilter extends BaseCandidateFilter {
  constructor(options = {}) {
    super({ ...options, id: FILTER_IDS.ALBUM });
  }

  supports(visualQuery) {
    return getConstraintValues(visualQuery, ['events', 'locations', 'photoTypes']).length > 0;
  }

  apply(pool, visualQuery) {
    const values = getConstraintValues(visualQuery, ['events', 'locations', 'photoTypes']);
    if (values.length === 0) return null;
    return pool.applyFilter(this.id, candidate => {
      if (!candidate.albums?.length) return { passed: true, confidence: 0.35, reason: 'album metadata unavailable' };
      const matched = containsAny(candidateText(candidate, ['albums']), values);
      return { passed: matched, confidence: matched ? 0.84 : 0.28, reason: matched ? 'album matched' : 'album mismatch' };
    });
  }
}

module.exports = AlbumFilter;
