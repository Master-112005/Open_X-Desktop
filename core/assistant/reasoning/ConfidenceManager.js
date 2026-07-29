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
    const entitySupport = Object.keys(context.entitySummary || {}).length > 0 ? 0.06 : 0;
    const contextSupport = context.evidence.some(item => item.type.startsWith('context.')) ? 0.04 : 0;
    const cognitive = context.futureExtensions.cognitiveReasoning || {};
    const cognitiveSignalCount = Array.isArray(cognitive.dimensions) ? cognitive.dimensions.length : 0;
    const cognitiveSupport = cognitiveSignalCount > 0
      ? Math.min(context.configuration?.cognitiveSignalBoost || 0.05, cognitiveSignalCount * 0.006)
      : 0;
    const uncertaintyPenalty = (cognitive.uncertainty?.score || 0) * (cognitive.uncertainty?.requiresClarification ? 0.12 : 0.04);
    const safetyPenalty = (cognitive.safety?.score || 0) * 0.05;
    const privacyPenalty = (cognitive.privacy?.score || 0) * 0.03;
    const overall = Math.max(0, Math.min(1,
      average([goal, intent, action, task || goal, clarification]) +
      entitySupport +
      contextSupport +
      cognitiveSupport -
      conflictPenalty -
      uncertaintyPenalty -
      safetyPenalty -
      privacyPenalty
    ));
    context.confidenceScores = {
      goal,
      intent,
      action,
      task,
      clarification,
      entitySupport,
      contextSupport,
      cognitiveSupport: Number(cognitiveSupport.toFixed(3)),
      uncertaintyPenalty: Number(uncertaintyPenalty.toFixed(3)),
      safetyPenalty: Number(safetyPenalty.toFixed(3)),
      privacyPenalty: Number(privacyPenalty.toFixed(3)),
      overall: Number(overall.toFixed(3)),
      explanations: {
        overall: 'deterministic evidence average with entity, context, cognitive, uncertainty, safety, and privacy calibration'
      }
    };
    context.diagnostics.confidenceDistribution = [goal, intent, action, task, clarification, cognitiveSupport, context.confidenceScores.overall];
    return context;
  }
}

module.exports = ConfidenceManager;
