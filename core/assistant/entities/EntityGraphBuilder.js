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
          confidence: entity.confidence
        })),
        relationships: context.relationships.slice()
      });
      return context;
    } catch (error) {
      throw new EntityGraphError('Failed to build immutable EntityGraph.', { cause: error });
    }
  }
}

module.exports = EntityGraphBuilder;
