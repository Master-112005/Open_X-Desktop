'use strict';

const PipelineStage = require('../pipeline/PipelineStage');
const StageResult = require('../pipeline/StageResult');
const { createDefaultSemanticManager } = require('./SemanticManager');

class SemanticUnderstandingStage extends PipelineStage {
  constructor(options = {}) {
    super({
      id: options.id || 'assistant.semantic.understanding',
      name: options.name || 'Assistant Semantic Understanding',
      order: Number.isFinite(options.order) ? options.order : -25,
      enabled: options.enabled !== false
    });
    this.manager = options.manager || createDefaultSemanticManager({
      configuration: options.configuration || {},
      logger: options.logger || null
    });
  }

  async execute(context) {
    if (!context.linguisticGraph) {
      return StageResult.skipped(this.id, 'No LinguisticGraph available.');
    }
    const semanticRepresentation = await this.manager.analyze(
      context.linguisticGraph,
      context.normalizedInputObject,
      { metadata: context.metadata }
    );
    context.semanticRepresentation = semanticRepresentation;
    context.set('assistant.semanticRepresentation', semanticRepresentation);
    return StageResult.ok(this.id, {
      input: context.normalizedInput || context.rawInput,
      source: context.source,
      options: { ...(context.options || {}) },
      semanticRepresentation: {
        conceptCount: semanticRepresentation.concepts.length,
        relationshipCount: semanticRepresentation.relationships.length,
        conversationType: semanticRepresentation.conversationType?.type || null,
        confidence: semanticRepresentation.confidenceScores?.overall || 0,
        version: semanticRepresentation.version
      }
    });
  }

  async destroy() {
    if (typeof this.manager?.destroy === 'function') this.manager.destroy();
    return super.destroy();
  }
}

module.exports = SemanticUnderstandingStage;
