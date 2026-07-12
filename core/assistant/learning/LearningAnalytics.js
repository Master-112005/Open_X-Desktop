'use strict';

class LearningAnalytics {
  summarize(context, storageResult = {}) {
    return {
      learningEvents: context.acceptedEvents.length,
      correctionsAccepted: storageResult.learned?.filter(item => item.category === 'corrections').length || 0,
      patternsDetected: storageResult.learned?.filter(item => item.category === 'patterns').length || 0,
      preferenceUpdates: storageResult.updatedPreferences?.length || 0,
      workflowFrequency: storageResult.updatedWorkflows?.length || 0
    };
  }
}

module.exports = LearningAnalytics;
