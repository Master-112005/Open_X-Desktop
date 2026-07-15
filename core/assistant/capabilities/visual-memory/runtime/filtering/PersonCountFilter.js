'use strict';

const BaseCandidateFilter = require('./BaseCandidateFilter');
const { FILTER_IDS } = require('./CandidateContracts');
const { getConstraintValues, normalize } = require('./filter-utils');

class PersonCountFilter extends BaseCandidateFilter {
  constructor(options = {}) {
    super({ ...options, id: FILTER_IDS.PERSON_COUNT });
  }

  supports(visualQuery) {
    return getConstraintValues(visualQuery, ['personCount']).length > 0;
  }

  apply(pool, visualQuery) {
    const wanted = getConstraintValues(visualQuery, ['personCount']).map(normalize);
    if (wanted.length === 0) return null;
    return pool.applyFilter(this.id, candidate => {
      const count = candidate.metadata?.personCount ?? candidate.metadata?.peopleCount ?? candidate.metadata?.faces;
      if (count === undefined || count === null || count === '') return { passed: true, confidence: 0.32, reason: 'person count metadata unavailable' };
      const numeric = Number(count);
      const group = Number.isFinite(numeric) && numeric >= 4;
      const matched = wanted.some(value => value === String(numeric) || value === 'group' && group);
      return { passed: matched, confidence: matched ? 0.86 : 0.22, reason: matched ? 'person count matched' : 'person count mismatch' };
    });
  }
}

module.exports = PersonCountFilter;
