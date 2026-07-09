'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

class SemanticRepresentation {
  constructor({
    originalInput = null,
    normalizedInput = null,
    linguisticGraph = null,
    semanticGraph = null,
    concepts = [],
    semanticRoles = [],
    relationships = [],
    conversationType = null,
    similarityResults = [],
    confidenceScores = {},
    diagnostics = [],
    metadata = {},
    timing = {},
    version = '5.0.0',
    futureExtensions = {}
  } = {}) {
    this.originalInput = originalInput || null;
    this.normalizedInput = normalizedInput || null;
    this.linguisticGraph = linguisticGraph || null;
    this.semanticGraph = semanticGraph || null;
    this.concepts = Array.isArray(concepts) ? concepts.slice() : [];
    this.semanticRoles = Array.isArray(semanticRoles) ? semanticRoles.slice() : [];
    this.relationships = Array.isArray(relationships) ? relationships.slice() : [];
    this.conversationType = conversationType || null;
    this.similarityResults = Array.isArray(similarityResults) ? similarityResults.slice() : [];
    this.confidenceScores = { ...(confidenceScores || {}) };
    this.diagnostics = Array.isArray(diagnostics) ? diagnostics.slice() : [];
    this.metadata = { ...(metadata || {}) };
    this.timing = { ...(timing || {}) };
    this.version = String(version || '5.0.0');
    this.futureExtensions = { ...(futureExtensions || {}) };
    deepFreeze(this);
  }
}

module.exports = SemanticRepresentation;
