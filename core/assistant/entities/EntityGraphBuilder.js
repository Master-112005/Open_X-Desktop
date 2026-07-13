'use strict';

const deepFreeze = require('../utils/ObjectFreeze');
const { EntityGraphError } = require('./EntityErrors');

class EntityGraphBuilder {
  constructor(options = {}) {
    this.id = options.id || 'entity.graphBuilder';
    this.priority = Number.isFinite(options.priority) ? options.priority : 1040;
  }

  process(context) {
    try {
      context.entityGraph = deepFreeze({
        nodes: context.allEntities().map(entity => ({
          id: entity.id,
          type: entity.type,
          value: entity.canonical || entity.value,
          rawValue: entity.rawValue,
          confidence: entity.confidence,
          resolved: entity.resolved || null,
          validation: entity.validation || null,
          position: {
            index: Number.isFinite(entity.metadata?.index) ? entity.metadata.index : null,
            length: Number.isFinite(entity.metadata?.length) ? entity.metadata.length : null
          },
          metadata: { ...(entity.metadata || {}) }
        })),
        relationships: context.relationships.map((relationship, index) => ({
          id: `relationship:${index + 1}`,
          ...relationship
        }))
      });
      return context;
    } catch (error) {
      throw new EntityGraphError('Failed to build immutable EntityGraph.', { cause: error });
    }
  }
}

module.exports = EntityGraphBuilder;
