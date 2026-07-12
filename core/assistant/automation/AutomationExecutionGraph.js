'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

class AutomationExecutionGraph {
  build(executionBlueprint = {}, controllerResults = []) {
    const resultByTask = new Map(controllerResults.map(result => [result.taskId, result]));
    return deepFreeze({
      nodes: (executionBlueprint.tasks || []).map(task => ({
        id: task.id,
        action: task.action,
        status: resultByTask.get(task.id)?.success ? 'completed' : resultByTask.has(task.id) ? 'failed' : 'skipped'
      })),
      edges: (executionBlueprint.dependencies || []).map(dependency => ({
        from: dependency.from,
        to: dependency.to,
        type: dependency.type
      }))
    });
  }
}

module.exports = AutomationExecutionGraph;
