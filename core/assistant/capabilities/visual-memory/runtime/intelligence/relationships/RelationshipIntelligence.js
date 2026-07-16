'use strict';

const { constraintValues, countExactMatches, includesAny } = require('../utils/intelligence-utils');

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
        if (relationships.length) {
          const exact = countExactMatches(evidence.relationships || [], relationships);
          if (exact > 0) {
            const coverage = exact / relationships.length;
            score += 0.72 * coverage + (coverage >= 1 ? 0.08 : 0);
          } else if (includesAny(evidence.text, relationships)) {
            score += 0.45;
          }
        }
        if (people.length) {
          const exact = countExactMatches(evidence.peopleNames || [], people);
          if (exact > 0) {
            const coverage = exact / people.length;
            score += 0.78 * coverage + (coverage >= 1 ? 0.1 : 0);
          } else if (includesAny(evidence.text, people)) {
            score += 0.48;
          }
        }
        if (owners.length) {
          const ownerMatched = countExactMatches(evidence.peopleNames || [], ['me', 'myself', 'user']) > 0
            || includesAny(evidence.text, ['me', 'myself', 'user']);
          if (ownerMatched) score += 0.45;
        }
        if (!relationships.length && !people.length && /family|friend|person/i.test(evidence.text)) score += 0.15;
        return Math.min(1, score);
      }
    };
  }
}

module.exports = RelationshipIntelligence;
