'use strict';

const ACTION_CONCEPTS = new Set([
  'OPEN', 'START', 'CLOSE', 'SEARCH', 'CREATE', 'DELETE', 'MOVE', 'COPY', 'SEND',
  'REMIND', 'ALARM', 'TIMER', 'PLAY', 'SET', 'ENABLE', 'DISABLE', 'INCREASE', 'REDUCE'
]);

class EntityRelationshipBuilder {
  constructor(options = {}) {
    this.id = options.id || 'entity.relationshipBuilder';
    this.priority = Number.isFinite(options.priority) ? options.priority : 1030;
  }

  process(context) {
    const concepts = Array.isArray(context.semanticRepresentation?.concepts)
      ? context.semanticRepresentation.concepts
      : [];
    const actions = concepts.filter(concept => ACTION_CONCEPTS.has(concept.concept));

    for (const action of actions) {
      for (const entity of context.allEntities()) {
        context.addRelationship({
          type: 'mentions',
          source: { kind: 'concept', id: action.id || null, value: action.concept },
          target: { kind: 'entity', id: entity.id, entityType: entity.type, value: entity.canonical || entity.value },
          confidence: Math.min(action.confidence || 0.6, entity.confidence || 0.6)
        });
      }
    }

    this._relateFirst(context, 'reminder', ['date', 'time', 'duration']);
    this._relateFirst(context, 'alarm', ['date', 'time']);
    this._relateFirst(context, 'timer', ['duration']);
    this._relateFirst(context, 'file', ['folder', 'path']);
    this._relateFirst(context, 'media', ['website', 'browser']);
    return context;
  }

  _relateFirst(context, sourceType, targetTypes) {
    const source = context.allEntities().find(entity => entity.type === sourceType);
    if (!source) return;
    for (const targetType of targetTypes) {
      const target = context.allEntities().find(entity => entity.type === targetType);
      if (target) {
        context.addRelationship({
          type: `${sourceType}-${targetType}`,
          source: { kind: 'entity', id: source.id, entityType: source.type, value: source.canonical || source.value },
          target: { kind: 'entity', id: target.id, entityType: target.type, value: target.canonical || target.value },
          confidence: Math.min(source.confidence || 0.6, target.confidence || 0.6)
        });
      }
    }
  }
}

module.exports = EntityRelationshipBuilder;
