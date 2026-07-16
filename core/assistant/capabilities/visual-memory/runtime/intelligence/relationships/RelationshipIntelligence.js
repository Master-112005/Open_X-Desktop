'use strict';

const { constraintValues, includesAny } = require('../utils/intelligence-utils');

class RelationshipIntelligence {
  reason(context) {
    const relationships = constraintValues(context.visualQuery, ['relationships']);
    const people = constraintValues(context.visualQuery, ['people']);
    const owners = constraintValues(context.visualQuery, ['owner']);
    return {
      relationships,
      people,
      owners,
      active: relationships.length > 0 || people.length > 0 || owners.length > 0,
      score(candidate, evidence) {
        let score = 0;
        if (relationships.length && includesAny(evidence.text, relationships)) score += 0.6;
        if (people.length && includesAny(evidence.text, people)) score += 0.7;
        if (owners.length && includesAny(evidence.text, ['me', 'myself', 'user'])) score += 0.45;
        if (!relationships.length && !people.length && /family|friend|person/i.test(evidence.text)) score += 0.15;
        return Math.min(1, score);
      }
    };
  }
}

module.exports = RelationshipIntelligence;
