'use strict';

const BaseDecision = require('./BaseDecision');

class ClarificationDecision extends BaseDecision {
  decide(context) {
    const metadataRequirements = context.executionBlueprint?.metadata?.clarificationRequirements || [];
    const requirements = Array.isArray(metadataRequirements) ? metadataRequirements.slice() : [];
    for (const task of this.tasks(context)) {
      const taskRequirements = task.metadata?.clarificationRequirements || task.metadata?.missingEntities || [];
      if (Array.isArray(taskRequirements)) {
        taskRequirements.forEach(requirement => requirements.push({
          taskId: task.id,
          action: task.action,
          ...(typeof requirement === 'string' ? { field: requirement } : requirement)
        }));
      }
      if (task.metadata?.needsClarification === true) {
        requirements.push({
          taskId: task.id,
          action: task.action,
          reason: task.metadata?.clarificationReason || 'task requires clarification'
        });
      }
    }
    if (requirements.length > 0) {
      requirements.forEach(requirement => context.addClarification(requirement));
    }
    return context;
  }
}

module.exports = ClarificationDecision;
