'use strict';

const { constraintValues, dateMs, normalize } = require('../utils/intelligence-utils');

class TimelineIntelligence {
  reason(context) {
    const values = constraintValues(context.visualQuery, ['time']);
    const queryText = normalize(values.join(' '));
    const wantsFirst = /\bfirst|oldest|earliest\b/.test(queryText);
    const wantsLatest = /\blatest|newest|recent\b/.test(queryText);
    const wantsBefore = /\bbefore\b/.test(queryText);
    const wantsAfter = /\bafter\b/.test(queryText);
    return {
      values,
      wantsFirst,
      wantsLatest,
      wantsBefore,
      wantsAfter,
      active: values.length > 0 || wantsFirst || wantsLatest || wantsBefore || wantsAfter,
      sort(candidates) {
        if (!wantsFirst && !wantsLatest) return candidates;
        const direction = wantsFirst ? 1 : -1;
        return candidates.slice().sort((left, right) => (dateMs(left) - dateMs(right)) * direction);
      },
      score(candidate) {
        if (!values.length) return 0.2;
        return dateMs(candidate) ? 0.55 : 0.1;
      }
    };
  }
}

module.exports = TimelineIntelligence;
