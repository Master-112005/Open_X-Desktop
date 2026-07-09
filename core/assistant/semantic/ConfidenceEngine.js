'use strict';

const BaseSemanticAnalyzer = require('./BaseSemanticAnalyzer');

function average(values) {
  const safe = values.filter(value => Number.isFinite(value));
  return safe.length ? safe.reduce((sum, value) => sum + value, 0) / safe.length : 0;
}

class ConfidenceEngine extends BaseSemanticAnalyzer {
  analyze(context) {
    const conceptConfidence = average((context.concepts || []).map(item => item.confidence));
    const roleConfidence = average((context.semanticRoles || []).map(item => item.confidence));
    const relationshipConfidence = average((context.relationships || []).map(item => item.confidence));
    const similarityConfidence = average((context.similarityResults || []).map(item => item.similarity));
    const conversationConfidence = Number(context.conversationType?.confidence || 0);
    const overall = average([conceptConfidence, roleConfidence, relationshipConfidence, conversationConfidence].filter(value => value > 0));
    context.confidenceScores = {
      meaning: conceptConfidence,
      dictionary: conceptConfidence,
      roles: roleConfidence,
      relationships: relationshipConfidence,
      similarity: similarityConfidence,
      conversation: conversationConfidence,
      overall,
      explanations: {
        meaning: 'Average confidence of dictionary concept matches.',
        roles: 'Average confidence of role labels derived from grammar.',
        relationships: 'Average confidence of semantic and grammar relationships.',
        overall: 'Average of available semantic dimensions; no execution decision is made.'
      }
    };
    return context;
  }
}

module.exports = ConfidenceEngine;
