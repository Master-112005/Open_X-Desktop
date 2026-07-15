'use strict';

const BaseCandidateFilter = require('./BaseCandidateFilter');
const { FILTER_IDS } = require('./CandidateContracts');
const { containsAny, getConstraintValues } = require('./filter-utils');

class CameraFilter extends BaseCandidateFilter {
  constructor(options = {}) {
    super({ ...options, id: FILTER_IDS.CAMERA });
  }

  supports(visualQuery) {
    return getConstraintValues(visualQuery, ['camera', 'sourceApps']).some(value => /camera|dslr|iphone|android|phone|canon|nikon|sony|samsung|pixel/i.test(value));
  }

  apply(pool, visualQuery) {
    const values = getConstraintValues(visualQuery, ['camera', 'sourceApps']);
    if (values.length === 0) return null;
    return pool.applyFilter(this.id, candidate => {
      const camera = candidate.metadata?.camera || {};
      const text = [camera.make, camera.model, camera.device, camera.lens, candidate.metadata?.captureDevice].filter(Boolean).join(' ');
      if (!text) return { passed: true, confidence: 0.34, reason: 'camera metadata unavailable' };
      const matched = containsAny(text, values);
      return { passed: matched, confidence: matched ? 0.9 : 0.2, reason: matched ? 'camera metadata matched' : 'camera metadata mismatch' };
    });
  }
}

module.exports = CameraFilter;
