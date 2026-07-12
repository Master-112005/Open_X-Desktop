'use strict';

const BaseSemanticAnalyzer = require('./BaseSemanticAnalyzer');
const deepFreeze = require('../utils/ObjectFreeze');

class SemanticGraphBuilder extends BaseSemanticAnalyzer {
  analyze(context) {
    const nodes = [];
    (context.concepts || []).forEach(concept => {
      nodes.push({
        id: concept.id,
        type: 'concept',
        label: concept.concept,
        value: concept.value,
        confidence: concept.confidence
      });
    });
    (context.semanticRoles || []).forEach((role, index) => {
      nodes.push({
        id: `role_${index}`,
        type: 'role',
        label: role.role,
        value: role.value,
        confidence: role.confidence
      });
    });
    if (context.conversationType) {
      nodes.push({
        id: 'conversation_type',
        type: 'conversationType',
        label: context.conversationType.type,
        confidence: context.conversationType.confidence
      });
    }
    const edges = (context.relationships || []).map((relationship, index) => ({
      id: `edge_${index}`,
      type: relationship.type,
      from: relationship.from,
      to: relationship.to,
      confidence: relationship.confidence
    }));
    context.semanticGraph = deepFreeze({
      nodes,
      edges,
      size: { nodes: nodes.length, edges: edges.length },
      confidence: context.confidenceScores?.overall || 0,
      version: context.configuration.version
    });
    return context;
  }
}

module.exports = SemanticGraphBuilder;
