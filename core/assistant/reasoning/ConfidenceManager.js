'use strict';

const BaseReasoner = require('./BaseReasoner');

function average(values) {
  const filtered = values.filter(Number.isFinite);
  if (filtered.length === 0) return 0;
  return Number((filtered.reduce((sum, value) => sum + value, 0) / filtered.length).toFixed(3));
}

class ConfidenceManager extends BaseReasoner {
  reason(context) {
    const goal = average(context.candidateGoals.map(item => item.confidence));
    const intent = average(context.candidateIntents.map(item => item.confidence));
    const action = average(context.candidateActions.map(item => item.confidence));
    const task = average(context.candidateTasks.map(item => item.confidence));
    const clarification = context.clarificationRequirements.length ? 0.5 : 0.9;
    const conflictPenalty = context.detectedConflicts.length ? 0.2 : 0;
    const overall = Math.max(0, average([goal, intent, action, task || goal, clarification]) - conflictPenalty);
    context.confidenceScores = {
      goal,
      intent,
      action,
      task,
      clarification,
      overall: Number(overall.toFixed(3)),
      explanations: {
        overall: 'deterministic evidence average; no execution, planning, validation, or response generation'
      }
    };
    context.diagnostics.confidenceDistribution = [goal, intent, action, task, clarification, context.confidenceScores.overall];
    return context;
  }
}

module.exports = ConfidenceManager;
