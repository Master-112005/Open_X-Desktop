'use strict';

const SemanticConfiguration = require('./SemanticConfiguration');
const SemanticContext = require('./SemanticContext');
const SemanticRegistry = require('./SemanticRegistry');
const SemanticPipeline = require('./SemanticPipeline');
const MeaningResolver = require('./MeaningResolver');
const SemanticNormalizer = require('./SemanticNormalizer');
const SemanticDictionary = require('./SemanticDictionary');
const SemanticRoleLabeler = require('./SemanticRoleLabeler');
const RelationshipAnalyzer = require('./RelationshipAnalyzer');
const ConversationClassifier = require('./ConversationClassifier');
const SimilarityEngine = require('./SimilarityEngine');
const ConfidenceEngine = require('./ConfidenceEngine');
const SemanticGraphBuilder = require('./SemanticGraphBuilder');

class SemanticManager {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof SemanticConfiguration
      ? options.configuration
      : new SemanticConfiguration(options.configuration || options);
    this.registry = options.registry || new SemanticRegistry();
    this.pipeline = options.pipeline || null;
    this.logger = options.logger || null;
    if (options.defaultAnalyzers !== false) this._registerDefaults();
  }

  _registerDefaults() {
    const defaults = [
      [MeaningResolver, 'semantic.meaningResolver', 10],
      [SemanticNormalizer, 'semantic.normalizer', 20],
      [SemanticDictionary, 'semantic.dictionary', 30],
      [SemanticRoleLabeler, 'semantic.roleLabeler', 40],
      [RelationshipAnalyzer, 'semantic.relationshipAnalyzer', 50],
      [ConversationClassifier, 'semantic.conversationClassifier', 60],
      [SimilarityEngine, 'semantic.similarityEngine', 70],
      [ConfidenceEngine, 'semantic.confidenceEngine', 80],
      [SemanticGraphBuilder, 'semantic.graphBuilder', 90]
    ];
    defaults.forEach(([Ctor, id, priority]) => {
      const configured = this.configuration.getAnalyzerOptions(id, { priority });
      this.registry.register(new Ctor({
        id,
        ...configured,
        dictionaries: this.configuration.dictionaries
      }), { id, priority: configured.priority });
    });
  }

  async analyze(linguisticGraph, normalizedInput = null, options = {}) {
    const context = new SemanticContext({
      linguisticGraph,
      normalizedInput,
      configuration: this.configuration,
      metadata: options.metadata || {}
    });
    if (!this.pipeline) {
      this.pipeline = new SemanticPipeline({
        registry: this.registry,
        configuration: this.configuration,
        logger: this.logger
      });
    }
    const semanticContext = await this.pipeline.run(context);
    return semanticContext.toRepresentation();
  }

  getStatus() {
    return {
      enabled: this.configuration.enabled,
      version: this.configuration.version,
      analyzers: this.registry.health()
    };
  }

  destroy() {
    this.registry.list().forEach(analyzer => {
      if (typeof analyzer.destroy === 'function') analyzer.destroy();
    });
    this.registry.clear();
    this.pipeline = null;
  }
}

function createDefaultSemanticManager(options = {}) {
  return new SemanticManager(options);
}

module.exports = {
  SemanticManager,
  createDefaultSemanticManager
};
