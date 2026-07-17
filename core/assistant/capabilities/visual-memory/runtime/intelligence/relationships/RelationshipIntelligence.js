'use strict';

const {
  constraintItems,
  constraintValues,
  countPersonMatches,
  countRelationshipMatches,
  includesPersonMention,
  includesRelationshipMention
} = require('../utils/intelligence-utils');

class RelationshipIntelligence {
  reason(context) {
    const relationships = constraintValues(context.visualQuery, ['relationships']);
    const people = constraintValues(context.visualQuery, ['people']);
    const owners = constraintItems(context.visualQuery, ['owner'])
      .filter(item => item.metadata?.explicit !== false)
      .map(item => String(item.value || '').trim())
      .filter(Boolean);
    return {
      relationships,
      people,
      owners,
      active: relationships.length > 0 || people.length > 0 || owners.length > 0,
      score(candidate, evidence) {
        let score = 0;
        if (relationships.length) {
          const exact = countRelationshipMatches(evidence.relationships || [], relationships);
          if (exact > 0) {
            const coverage = exact / relationships.length;
            score += 0.72 * coverage + (coverage >= 1 ? 0.08 : 0);
          } else if (includesRelationshipMention(evidence.text, relationships)) {
            score += 0.45;
          }
        }
        if (people.length) {
          const exact = countPersonMatches(evidence.peopleNames || [], people);
          if (exact > 0) {
            const coverage = exact / people.length;
            score += 0.78 * coverage + (coverage >= 1 ? 0.1 : 0);
          } else if (includesPersonMention(evidence.text, people)) {
            score += 0.48;
          }
        }
        if (owners.length) {
          const ownerMatched = countPersonMatches(evidence.peopleNames || [], owners) > 0
            || includesPersonMention(evidence.text, owners);
          if (ownerMatched) score += 0.45;
        }
        if (!relationships.length && !people.length && !owners.length && /family|friend|person/i.test(evidence.text)) score += 0.15;
        return Math.min(1, score);
      }
    };
  }
}

module.exports = RelationshipIntelligence;
