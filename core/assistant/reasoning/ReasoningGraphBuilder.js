'use strict';

const BaseReasoner = require('./BaseReasoner');
const deepFreeze = require('../utils/ObjectFreeze');

class ReasoningGraphBuilder extends BaseReasoner {
  reason(context) {
    const nodes = [];
    const edges = [];
    const addNode = (id, type, value, confidence = 0, metadata = {}) => {
      nodes.push({ id, type, value, confidence, metadata });
    };

    context.evidence.forEach((item, index) => addNode(`evidence:${index + 1}`, 'evidence', item.value, item.confidence, { evidenceType: item.type, source: item.source }));
    context.candidateGoals.forEach((item, index) => addNode(`goal:${index + 1}`, 'goal', item.id, item.confidence, { name: item.name, source: item.source }));
    context.candidateIntents.forEach((item, index) => addNode(`intent:${index + 1}`, 'intent', item.intent, item.confidence, { source: item.source }));
    context.candidateActions.forEach((item, index) => addNode(`action:${index + 1}`, 'action', item.action, item.confidence, { source: item.source, ...(item.metadata || {}) }));
    context.candidateTasks.forEach((item, index) => addNode(`task:${index + 1}`, 'task', item.task, item.confidence, { action: item.action || null, source: item.source }));
    context.detectedConflicts.forEach((item, index) => addNode(`conflict:${index + 1}`, 'conflict', item.type, item.confidence));
    context.clarificationRequirements.forEach((item, index) => addNode(`clarification:${index + 1}`, 'clarification', item.requirement, item.confidence));

    for (const goal of context.candidateGoals) {
      context.evidence.forEach((evidence, index) => {
        if ((goal.evidence || []).includes(evidence.value) || (goal.evidence || []).includes(evidence.type)) {
          edges.push({ from: `evidence:${index + 1}`, to: `goal:${context.candidateGoals.indexOf(goal) + 1}`, type: 'supports' });
        }
      });
    }
    context.candidateIntents.forEach((intent, index) => {
      const goalIndex = context.candidateGoals.findIndex(goal => (intent.evidence || []).includes(goal.id));
      if (goalIndex >= 0) edges.push({ from: `goal:${goalIndex + 1}`, to: `intent:${index + 1}`, type: 'implies' });
    });
    context.candidateActions.forEach((action, index) => {
      const intentIndex = context.candidateIntents.findIndex(intent => (action.evidence || []).includes(intent.intent));
      if (intentIndex >= 0) edges.push({ from: `intent:${intentIndex + 1}`, to: `action:${index + 1}`, type: 'suggests' });
    });

    context.reasoningGraph = deepFreeze({
      nodes,
      edges,
      confidence: context.confidenceScores.overall || 0,
      entitySummary: { ...(context.entitySummary || {}) },
      path: context.diagnostics.pipelineOrder.slice()
    });
    return context;
  }
}

module.exports = ReasoningGraphBuilder;
