'use strict';

class LearningAnalytics {
  summarize(context, storageResult = {}) {
    const learned = Array.isArray(storageResult.learned) ? storageResult.learned : [];
    const rejected = Array.isArray(context.itemsRejected) ? context.itemsRejected : [];
    return {
      learningEvents: context.acceptedEvents.length,
      rejectedEvents: rejected.length,
      storageWrites: storageResult.storageWrites || 0,
      correctionsAccepted: learned.filter(item => item.category === 'corrections').length,
      aliasesAccepted: learned.filter(item => item.category === 'aliases').length,
      habitsAccepted: learned.filter(item => item.category === 'habits').length,
      patternsDetected: learned.filter(item => item.category === 'patterns').length,
      preferenceUpdates: storageResult.updatedPreferences?.length || 0,
      workflowFrequency: storageResult.updatedWorkflows?.length || 0,
      moduleCount: Object.keys(context.metadata.modules || {}).length,
      durationMs: Math.max(0, Date.now() - context.timing.startedAt)
    };
  }
}

module.exports = LearningAnalytics;
