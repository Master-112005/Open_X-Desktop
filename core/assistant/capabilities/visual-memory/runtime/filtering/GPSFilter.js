'use strict';

const BaseCandidateFilter = require('./BaseCandidateFilter');
const { FILTER_IDS } = require('./CandidateContracts');
const { containsAny, getConstraintValues } = require('./filter-utils');

class GPSFilter extends BaseCandidateFilter {
  constructor(options = {}) {
    super({ ...options, id: FILTER_IDS.GPS });
  }

  supports(visualQuery) {
    return getConstraintValues(visualQuery, ['locations']).length > 0;
  }

  apply(pool, visualQuery) {
    const locations = getConstraintValues(visualQuery, ['locations']);
    if (locations.length === 0) return null;
    return pool.applyFilter(this.id, candidate => {
      const gps = candidate.metadata?.gps || {};
      const gpsText = [gps.city, gps.country, gps.region, gps.place, gps.name].filter(Boolean).join(' ');
      if (!gpsText) return { passed: true, confidence: 0.34, reason: 'gps metadata unavailable' };
      const matched = containsAny(gpsText, locations);
      return { passed: matched, confidence: matched ? 0.92 : 0.18, reason: matched ? 'gps metadata matched' : 'gps metadata mismatch' };
    });
  }
}

module.exports = GPSFilter;
