'use strict';

const BaseCandidateFilter = require('./BaseCandidateFilter');
const { FILTER_IDS } = require('./CandidateContracts');
const { dateRangeFromExpression, dateValue, getConstraintValues } = require('./filter-utils');

class DateFilter extends BaseCandidateFilter {
  constructor(options = {}) {
    super({ ...options, id: FILTER_IDS.DATE });
    this.now = options.now || (() => new Date());
  }

  supports(visualQuery) {
    return getConstraintValues(visualQuery, ['time']).length > 0;
  }

  apply(pool, visualQuery) {
    const ranges = getConstraintValues(visualQuery, ['time'])
      .map(value => dateRangeFromExpression(value, this.now()))
      .filter(Boolean);
    if (ranges.length === 0) {
      pool.addDiagnostic({ filterId: this.id, skipped: true, reason: 'No parseable date constraints.' });
      return null;
    }
    return pool.applyFilter(this.id, candidate => {
      const value = dateValue(candidate);
      if (!value) return { passed: true, confidence: 0.35, reason: 'date metadata missing' };
      const matched = ranges.some(range => value >= range.start && value <= range.end);
      return { passed: matched, confidence: matched ? 0.9 : 0.2, reason: matched ? 'date range matched' : 'outside date range' };
    });
  }
}

module.exports = DateFilter;
