'use strict';

const BaseSemanticAnalyzer = require('./BaseSemanticAnalyzer');

class SemanticNormalizer extends BaseSemanticAnalyzer {
  analyze(context) {
    const seen = new Map();
    context.concepts = (context.concepts || []).filter(concept => {
      const key = `${concept.concept}:${concept.tokenId || concept.value}`;
      if (seen.has(key)) return false;
      seen.set(key, true);
      concept.normalizedConcept = String(concept.concept || '').toUpperCase();
      return true;
    });
    return context;
  }
}

module.exports = SemanticNormalizer;
