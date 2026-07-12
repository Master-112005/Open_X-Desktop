'use strict';

const BaseSemanticAnalyzer = require('./BaseSemanticAnalyzer');

function jaccard(left = [], right = []) {
  const a = new Set(left);
  const b = new Set(right);
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = [...a].filter(item => b.has(item)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

class SimilarityEngine extends BaseSemanticAnalyzer {
  analyze(context) {
    const concepts = context.concepts || [];
    context.similarityResults = concepts.flatMap((left, leftIndex) => concepts.slice(leftIndex + 1).map(right => ({
      leftConceptId: left.id,
      rightConceptId: right.id,
      leftConcept: left.concept,
      rightConcept: right.concept,
      similarity: left.concept === right.concept ? 1 : jaccard(left.concept.split('_'), right.concept.split('_')),
      method: 'deterministic-concept-jaccard'
    })));
    return context;
  }
}

module.exports = SimilarityEngine;
