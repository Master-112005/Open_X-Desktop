'use strict';

const BaseDecision = require('./BaseDecision');

class ExecutionDecision extends BaseDecision {
  decide(context) {
    const blueprint = context.executionBlueprint || {};
    const taskIds = new Set((blueprint.tasks || []).map(task => task.id));
    const missing = (blueprint.dependencies || []).filter(dependency => !taskIds.has(dependency.from) || !taskIds.has(dependency.to));
    if (missing.length > 0) {
      context.setStatus('WAIT', 'execution blueprint has missing dependencies');
      context.futureExtensions.missingDependencies = missing;
    }
    return context;
  }
}

module.exports = ExecutionDecision;
