'use strict';

const PipelineStage = require('../pipeline/PipelineStage');
const StageResult = require('../pipeline/StageResult');
const { createDefaultEntityManager } = require('./EntityManager');

class EntityUnderstandingStage extends PipelineStage {
  constructor(options = {}) {
    super({
      id: options.id || 'assistant.entity.understanding',
      name: options.name || 'Assistant Entity Understanding',
      order: Number.isFinite(options.order) ? options.order : -10,
      enabled: options.enabled !== false
    });
    this.manager = options.manager || createDefaultEntityManager({
      configuration: options.configuration || {},
      logger: options.logger || null
    });
  }

  async execute(context) {
    if (!context.semanticRepresentation) {
      return StageResult.skipped(this.id, 'No SemanticRepresentation available.');
    }
    const structuredEntities = await this.manager.understand(context.semanticRepresentation, {
      metadata: context.metadata
    });
    context.structuredEntities = structuredEntities;
    context.set('assistant.structuredEntities', structuredEntities);
    const entityTypes = Object.fromEntries(
      structuredEntities.entityGraph.nodes.reduce((counts, node) => {
        counts.set(node.type, (counts.get(node.type) || 0) + 1);
        return counts;
      }, new Map())
    );
    return StageResult.ok(this.id, {
      entityCount: structuredEntities.entityGraph.nodes.length,
      relationshipCount: structuredEntities.relationships.length,
      entityTypes,
      confidence: structuredEntities.confidence,
      version: structuredEntities.version
    });
  }

  async destroy() {
    if (typeof this.manager?.destroy === 'function') this.manager.destroy();
    return super.destroy();
  }
}

module.exports = EntityUnderstandingStage;
