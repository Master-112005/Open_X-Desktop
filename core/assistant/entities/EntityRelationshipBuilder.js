'use strict';

class EntityRelationshipBuilder {
  constructor(options = {}) {
    this.id = options.id || 'entity.relationshipBuilder';
    this.priority = Number.isFinite(options.priority) ? options.priority : 1030;
  }

  process(context) {
    const concepts = Array.isArray(context.semanticRepresentation?.concepts)
      ? context.semanticRepresentation.concepts
      : [];
    const action = concepts.find(concept => ['OPEN', 'CLOSE', 'SEARCH', 'CREATE', 'MOVE', 'REMIND', 'PLAY', 'SET'].includes(concept.concept));
    if (!action) return context;

    for (const entity of context.allEntities()) {
      context.addRelationship({
        type: 'semantic-entity',
        source: { kind: 'concept', value: action.concept },
        target: { kind: 'entity', id: entity.id, entityType: entity.type, value: entity.canonical || entity.value },
        confidence: Math.min(action.confidence || 0.6, entity.confidence || 0.6)
      });
    }
    return context;
  }
}

module.exports = EntityRelationshipBuilder;
