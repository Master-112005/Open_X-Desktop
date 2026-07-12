'use strict';

const BaseSemanticAnalyzer = require('./BaseSemanticAnalyzer');

const ACTION_CONCEPTS = new Set(['OPEN', 'START', 'CLOSE', 'DISABLE', 'ENABLE', 'REDUCE', 'INCREASE', 'SEND', 'FIND', 'CREATE', 'DELETE', 'MOVE', 'STORE']);

class RelationshipAnalyzer extends BaseSemanticAnalyzer {
  analyze(context) {
    const concepts = context.concepts || [];
    const actions = concepts.filter(concept => ACTION_CONCEPTS.has(concept.concept));
    const targets = concepts.filter(concept => !ACTION_CONCEPTS.has(concept.concept));
    const relationships = [];
    actions.forEach(action => {
      const target = targets.find(candidate => !action.tokenId || !candidate.tokenId || candidate.tokenId !== action.tokenId);
      if (target) {
        relationships.push({
          type: 'concept-target',
          from: action.id,
          to: target.id,
          sourceConcept: action.concept,
          targetConcept: target.concept,
          confidence: Math.min(action.confidence, target.confidence)
        });
      }
    });
    (context.linguisticGraph?.dependencies || []).forEach(edge => {
      relationships.push({
        type: `grammar-${edge.relation}`,
        from: edge.governor,
        to: edge.dependent,
        confidence: edge.confidence || 0.5
      });
    });
    context.relationships = relationships;
    return context;
  }
}

module.exports = RelationshipAnalyzer;
