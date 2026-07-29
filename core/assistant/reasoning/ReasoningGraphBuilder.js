'use strict';

const BaseReasoner = require('./BaseReasoner');
const deepFreeze = require('../utils/ObjectFreeze');

const SENSITIVE_METADATA = /(?:password|token|secret|key|otp|pin|phone|email|privateKey|session)/i;

function cleanMetadata(value, depth = 0) {
  if (!value || typeof value !== 'object') return value;
  if (depth > 2) return '[Object]';
  if (Array.isArray(value)) return value.slice(0, 12).map(item => cleanMetadata(item, depth + 1));
  const next = {};
  for (const [key, item] of Object.entries(value)) {
    next[key] = SENSITIVE_METADATA.test(key) ? '[REDACTED]' : cleanMetadata(item, depth + 1);
  }
  return next;
}

function rounded(value) {
  return Number((Math.max(0, Math.min(1, Number(value) || 0))).toFixed(3));
}

function itemKey(item = {}) {
  return item.id || item.intent || item.action || item.task || item.requirement || item.type || item.value || '';
}

function sortByConfidence(list = []) {
  return list.slice().sort((left, right) =>
    (Number(right.confidence) || 0) - (Number(left.confidence) || 0) ||
    String(itemKey(left)).localeCompare(String(itemKey(right)))
  );
}

class ReasoningGraphBuilder extends BaseReasoner {
  reason(context) {
    const maxNodes = context.configuration?.graphMaxNodes || 220;
    const maxEdges = context.configuration?.graphMaxEdges || 360;
    const nodes = [];
    const edges = [];
    const nodeByKey = new Map();

    const addNode = (key, type, value, confidence = 0, metadata = {}) => {
      if (!key || nodeByKey.has(key)) return nodeByKey.get(key) || null;
      if (nodes.length >= maxNodes) return null;
      const node = {
        id: key,
        type,
        value: String(value || ''),
        confidence: rounded(confidence),
        metadata: cleanMetadata(metadata || {})
      };
      nodes.push(node);
      nodeByKey.set(key, node);
      return node;
    };

    const addEdge = (from, to, type, confidence = 0.6, metadata = {}) => {
      if (!from || !to || from === to || edges.length >= maxEdges) return null;
      if (!nodeByKey.has(from) || !nodeByKey.has(to)) return null;
      const key = `${from}->${to}:${type}`;
      if (edges.some(edge => edge.key === key)) return null;
      const edge = {
        key,
        from,
        to,
        type,
        confidence: rounded(confidence),
        metadata: cleanMetadata(metadata || {})
      };
      edges.push(edge);
      return edge;
    };

    const inputNode = addNode('input:command', 'input', context.normalizedInput || context.input, 1, {
      source: context.metadata?.source || context.resolvedContext?.metadata?.source || ''
    });

    const evidenceIds = this._addEvidenceNodes(context, addNode, addEdge, inputNode?.id);
    const cognitiveIds = this._addCognitiveNodes(context, addNode, addEdge, inputNode?.id, evidenceIds);
    const goalIds = this._addCandidateNodes(context, 'candidateGoals', 'goal', addNode);
    const intentIds = this._addCandidateNodes(context, 'candidateIntents', 'intent', addNode);
    const actionIds = this._addCandidateNodes(context, 'candidateActions', 'action', addNode);
    const taskIds = this._addCandidateNodes(context, 'candidateTasks', 'task', addNode);
    const conflictIds = this._addCandidateNodes(context, 'detectedConflicts', 'conflict', addNode);
    const clarificationIds = this._addCandidateNodes(context, 'clarificationRequirements', 'clarification', addNode);

    this._connectEvidenceToGoals(context, evidenceIds, goalIds, addEdge);
    this._connectGoalsToIntents(context, goalIds, intentIds, addEdge);
    this._connectIntentsToActions(context, intentIds, actionIds, addEdge);
    this._connectActionsToTasks(context, actionIds, taskIds, addEdge);
    this._connectCognitiveToActions(context, cognitiveIds, actionIds, addEdge);
    this._connectReviewNodes(context, cognitiveIds, actionIds, conflictIds, clarificationIds, addEdge);

    const graphStats = {
      nodes: nodes.length,
      edges: edges.length,
      bounded: nodes.length >= maxNodes || edges.length >= maxEdges,
      maxNodes,
      maxEdges,
      cognitiveNodes: Object.keys(cognitiveIds).length,
      evidenceNodes: Object.keys(evidenceIds).length,
      goalNodes: Object.keys(goalIds).length,
      intentNodes: Object.keys(intentIds).length,
      actionNodes: Object.keys(actionIds).length,
      taskNodes: Object.keys(taskIds).length
    };
    context.diagnostics.graphStats = graphStats;
    context.reasoningGraph = deepFreeze({
      nodes: nodes.map(({ id, type, value, confidence, metadata }) => ({ id, type, value, confidence, metadata })),
      edges: edges.map(({ from, to, type, confidence, metadata }) => ({ from, to, type, confidence, metadata })),
      confidence: context.confidenceScores.overall || 0,
      entitySummary: { ...(context.entitySummary || {}) },
      path: context.diagnostics.pipelineOrder.slice(),
      stats: graphStats,
      cognitiveSummary: this._cognitiveSummary(context)
    });
    return context;
  }

  _addEvidenceNodes(context, addNode, addEdge, inputNodeId) {
    const ids = {};
    sortByConfidence(context.evidence).forEach((item, index) => {
      const id = `evidence:${index + 1}`;
      addNode(id, 'evidence', item.value, item.confidence, {
        evidenceType: item.type,
        source: item.source,
        ...(item.metadata || {})
      });
      ids[`${item.type}:${item.value}`] = id;
      ids[item.type] = ids[item.type] || id;
      addEdge(inputNodeId, id, 'observes', item.confidence);
    });
    return ids;
  }

  _addCognitiveNodes(context, addNode, addEdge, inputNodeId, evidenceIds) {
    const cognitive = context.futureExtensions.cognitiveReasoning || {};
    const ids = {};
    for (const dimension of cognitive.dimensions || []) {
      const id = `cognitive:${dimension.id}`;
      addNode(id, 'cognitive-dimension', dimension.id, dimension.confidence, {
        name: dimension.name,
        evidence: dimension.evidence
      });
      ids[dimension.id] = id;
      addEdge(inputNodeId, id, 'interprets', dimension.confidence);
      for (const evidence of dimension.evidence || []) {
        const evidenceId = evidenceIds[`reasoning.${dimension.id}:${evidence}`] || evidenceIds[`reasoning.${dimension.id}`];
        addEdge(evidenceId, id, 'supports', dimension.confidence);
      }
    }

    for (const hiddenIntent of cognitive.hiddenIntents || []) {
      const id = `hidden-intent:${hiddenIntent.id}`;
      addNode(id, 'hidden-intent', hiddenIntent.id, hiddenIntent.confidence, {
        alternatives: hiddenIntent.alternatives
      });
      ids[hiddenIntent.id] = id;
      addEdge(inputNodeId, id, 'hypothesizes', hiddenIntent.confidence);
    }

    for (const key of ['uncertainty', 'safety', 'privacy', 'learning', 'selfReflection']) {
      const item = cognitive[key];
      if (!item) continue;
      const score = key === 'selfReflection' ? (item.required ? 0.72 : 0.2) : item.score;
      if (!score) continue;
      const id = `cognitive-score:${key}`;
      addNode(id, `cognitive-${key}`, key, score, item);
      ids[key] = id;
      addEdge(inputNodeId, id, key === 'selfReflection' ? 'reviews' : 'scores', score);
    }
    return ids;
  }

  _addCandidateNodes(context, listName, type, addNode) {
    const ids = {};
    sortByConfidence(context[listName] || []).forEach((item, index) => {
      const value = itemKey(item);
      const id = `${type}:${index + 1}`;
      addNode(id, type, value, item.confidence, {
        source: item.source,
        ...(type === 'goal' ? { name: item.name } : {}),
        ...(type === 'task' ? { action: item.action || null } : {}),
        ...(type === 'conflict' ? { actions: item.actions || [] } : {}),
        ...(type === 'clarification' ? { field: item.field || null, reason: item.reason || '' } : {}),
        ...(item.metadata || {})
      });
      ids[value] = id;
    });
    return ids;
  }

  _connectEvidenceToGoals(context, evidenceIds, goalIds, addEdge) {
    for (const goal of context.candidateGoals || []) {
      const goalId = goalIds[goal.id];
      for (const evidence of goal.evidence || []) {
        const evidenceId = evidenceIds[evidence] || Object.entries(evidenceIds).find(([key]) => key.endsWith(`:${evidence}`))?.[1];
        addEdge(evidenceId, goalId, 'supports-goal', goal.confidence);
      }
    }
  }

  _connectGoalsToIntents(context, goalIds, intentIds, addEdge) {
    for (const intent of context.candidateIntents || []) {
      const intentId = intentIds[intent.intent];
      for (const evidence of intent.evidence || []) {
        addEdge(goalIds[evidence], intentId, 'implies-intent', intent.confidence);
      }
    }
  }

  _connectIntentsToActions(context, intentIds, actionIds, addEdge) {
    for (const action of context.candidateActions || []) {
      const actionId = actionIds[action.action];
      for (const evidence of action.evidence || []) {
        addEdge(intentIds[evidence], actionId, 'suggests-action', action.confidence);
      }
    }
  }

  _connectActionsToTasks(context, actionIds, taskIds, addEdge) {
    for (const task of context.candidateTasks || []) {
      const taskId = taskIds[task.task];
      addEdge(actionIds[task.action], taskId, 'plans-task', task.confidence);
    }
  }

  _connectCognitiveToActions(context, cognitiveIds, actionIds, addEdge) {
    const cognitive = context.futureExtensions.cognitiveReasoning || {};
    const dimensions = new Set((cognitive.dimensions || []).map(item => item.id));
    for (const action of context.candidateActions || []) {
      const actionId = actionIds[action.action];
      if (!actionId) continue;
      const actionDimensions = this._dimensionsForAction(action.action, dimensions);
      for (const dimension of actionDimensions) {
        addEdge(cognitiveIds[dimension], actionId, 'cognitive-support', action.confidence);
      }
      if (action.metadata?.dangerous || action.metadata?.requiresConfirmation) addEdge(cognitiveIds.safety, actionId, 'requires-review', cognitive.safety?.score || 0.72);
      if (action.metadata?.privacySensitive) addEdge(cognitiveIds.privacy, actionId, 'privacy-review', cognitive.privacy?.score || 0.72);
      if (action.metadata?.uncertain) addEdge(cognitiveIds.uncertainty, actionId, 'clarify-before-action', cognitive.uncertainty?.score || 0.72);
    }
  }

  _connectReviewNodes(context, cognitiveIds, actionIds, conflictIds, clarificationIds, addEdge) {
    const topActionId = actionIds[context.ranked('candidateActions')[0]?.action];
    for (const conflictId of Object.values(conflictIds)) {
      addEdge(topActionId, conflictId, 'may-conflict', 0.72);
      addEdge(cognitiveIds.selfReflection, conflictId, 'reviewed-by', 0.66);
    }
    for (const clarificationId of Object.values(clarificationIds)) {
      addEdge(cognitiveIds.uncertainty, clarificationId, 'asks-clarification', 0.72);
      addEdge(topActionId, clarificationId, 'needs-information', 0.62);
    }
  }

  _dimensionsForAction(action, dimensions) {
    const has = (...ids) => ids.filter(id => dimensions.has(id));
    if (['CREATE_REMINDER', 'SET_ALARM', 'SET_TIMER'].includes(action)) return has('temporal', 'planning', 'preference');
    if (['OPEN_APPLICATION', 'CLOSE_APPLICATION', 'PAUSE_MEDIA', 'RESUME_MEDIA'].includes(action)) return has('context', 'conversation', 'commonSense');
    if (action === 'PLAY_MEDIA') return has('preference', 'personalMemory', 'knowledge', 'emotional');
    if (['OPEN_FILE', 'OPEN_FOLDER', 'MOVE_FILE', 'DELETE_FILE'].includes(action)) return has('knowledge', 'spatial', 'privacy', 'safety');
    if (action === 'TRANSFER_FILE') return has('identity', 'privacy', 'spatial', 'conversation');
    if (action === 'SEARCH_WEB') return has('knowledge', 'decision', 'causal', 'uncertainty');
    if (['SET_VOLUME', 'MUTE_AUDIO', 'SET_BRIGHTNESS'].includes(action)) return has('causal', 'commonSense', 'context');
    return [];
  }

  _cognitiveSummary(context) {
    const cognitive = context.futureExtensions.cognitiveReasoning || {};
    return {
      dimensions: (cognitive.dimensions || []).slice(0, 8).map(item => item.id),
      hiddenIntents: (cognitive.hiddenIntents || []).slice(0, 5).map(item => item.id),
      uncertainty: cognitive.uncertainty?.level || 'none',
      safety: cognitive.safety?.level || 'none',
      privacy: cognitive.privacy?.level || 'none',
      learning: cognitive.learning?.level || 'none'
    };
  }
}

module.exports = ReasoningGraphBuilder;
