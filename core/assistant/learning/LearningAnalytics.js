'use strict';

function countBy(list, keySelector) {
  return list.reduce((counts, item) => {
    const key = String(keySelector(item) || 'unknown');
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

class LearningAnalytics {
  summarize(context, storageResult = {}) {
    const learned = Array.isArray(storageResult.learned) ? storageResult.learned : [];
    const rejected = Array.isArray(context.itemsRejected) ? context.itemsRejected : [];
    const modules = context.metadata.modules || {};
    const slowModules = Object.entries(modules)
      .filter(([, module]) => Number(module.durationMs || 0) >= Math.max(25, context.configuration?.moduleTimeoutMs || 250))
      .map(([id, module]) => ({ id, durationMs: module.durationMs, skipped: module.skipped === true }))
      .slice(0, 10);
    return {
      learningEvents: context.acceptedEvents.length,
      rejectedEvents: rejected.length,
      storageWrites: storageResult.storageWrites || 0,
      learnedByCategory: countBy(learned, item => item.category),
      rejectedByReason: countBy(rejected, item => item.reason),
      correctionsAccepted: learned.filter(item => item.category === 'corrections').length,
      aliasesAccepted: learned.filter(item => item.category === 'aliases').length,
      habitsAccepted: learned.filter(item => item.category === 'habits').length,
      patternsDetected: learned.filter(item => item.category === 'patterns').length,
      preferenceUpdates: storageResult.updatedPreferences?.length || 0,
      workflowFrequency: storageResult.updatedWorkflows?.length || 0,
      personalization: context.metadata.personalization || null,
      learningPrompts: Array.isArray(context.metadata.learningPrompts) ? context.metadata.learningPrompts.length : 0,
      moduleCount: Object.keys(modules).length,
      slowModules,
      durationMs: Math.max(0, Date.now() - context.timing.startedAt)
    };
  }
}

module.exports = LearningAnalytics;
