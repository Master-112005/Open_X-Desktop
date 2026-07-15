'use strict';

const { constraintValues, includesAny } = require('../utils/intelligence-utils');

const EVENT_KEYWORDS = Object.freeze({
  birthday: ['birthday', 'cake', 'party'],
  wedding: ['wedding', 'marriage', 'reception'],
  festival: ['festival', 'diwali', 'christmas', 'eid', 'pongal'],
  vacation: ['vacation', 'trip', 'holiday', 'travel'],
  meeting: ['meeting', 'conference', 'office event'],
  graduation: ['graduation', 'college function'],
  anniversary: ['anniversary', 'celebration'],
  family: ['family gathering', 'family']
});

class EventIntelligence {
  reason(context) {
    const requested = constraintValues(context.visualQuery, ['events']);
    return {
      requested,
      active: requested.length > 0,
      classify(candidate, evidence) {
        const matched = [];
        for (const [eventId, keywords] of Object.entries(EVENT_KEYWORDS)) {
          const queryMatched = requested.some(value => keywords.some(keyword => value.toLowerCase().includes(keyword)));
          const evidenceMatched = includesAny(evidence.text, keywords);
          if (queryMatched || evidenceMatched) {
            matched.push({
              id: eventId,
              confidence: queryMatched ? 0.84 : 0.56,
              source: queryMatched ? 'visual-query' : 'memory-evidence'
            });
          }
        }
        return matched;
      }
    };
  }
}

module.exports = EventIntelligence;
