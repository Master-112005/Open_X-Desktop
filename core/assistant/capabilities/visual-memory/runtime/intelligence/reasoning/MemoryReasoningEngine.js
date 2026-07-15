'use strict';

const { SEARCH_STRATEGIES } = require('../contracts/MemoryIntelligenceContracts');
const { constraintValues } = require('../utils/intelligence-utils');

class MemoryReasoningEngine {
  constructor(options = {}) {
    this.relationshipIntelligence = options.relationshipIntelligence;
    this.timelineIntelligence = options.timelineIntelligence;
    this.collectionManager = options.collectionManager;
    this.eventIntelligence = options.eventIntelligence || null;
  }

  reason(context) {
    const strategies = new Set([SEARCH_STRATEGIES.MEMORY]);
    if (constraintValues(context.visualQuery, ['scenes']).length) strategies.add(SEARCH_STRATEGIES.SCENE);
    if (constraintValues(context.visualQuery, ['events']).length) strategies.add(SEARCH_STRATEGIES.TIMELINE);
    if (constraintValues(context.visualQuery, ['relationships', 'people']).length) strategies.add(SEARCH_STRATEGIES.RELATIONSHIP);
    if (constraintValues(context.visualQuery, ['documentTypes']).length) strategies.add(SEARCH_STRATEGIES.DOCUMENT);
    if (constraintValues(context.visualQuery, ['sourceApps']).length) strategies.add(SEARCH_STRATEGIES.SCREENSHOT);
    if (context.options.referenceEmbedding) strategies.add(SEARCH_STRATEGIES.SIMILARITY);
    if (strategies.size > 1) strategies.add(SEARCH_STRATEGIES.COMBINED);

    const relationshipPlan = this.relationshipIntelligence.reason(context);
    const timelinePlan = this.timelineIntelligence.reason(context);
    const eventPlan = this.eventIntelligence?.reason?.(context) || {
      requested: constraintValues(context.visualQuery, ['events']),
      active: constraintValues(context.visualQuery, ['events']).length > 0,
      classify: () => []
    };
    const collections = this.collectionManager.inferCollections(context, context.getCandidates());

    return {
      strategies: Array.from(strategies),
      relationshipPlan,
      timelinePlan,
      eventPlan,
      collections,
      constraints: {
        locations: constraintValues(context.visualQuery, ['locations']),
        events: constraintValues(context.visualQuery, ['events']),
        scenes: constraintValues(context.visualQuery, ['scenes']),
        objects: constraintValues(context.visualQuery, ['queryText', 'photoTypes', 'documentTypes', 'sourceApps'])
      },
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = MemoryReasoningEngine;
