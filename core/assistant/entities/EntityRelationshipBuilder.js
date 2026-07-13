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
    this._relateFirst(context, 'contact', ['person', 'website']);
    this._dedupeRelationships(context);
    return context;
  }

  _relateFirst(context, sourceType, targetTypes) {
    const sources = context.allEntities().filter(entity => entity.type === sourceType);
    if (sources.length === 0) return;
    for (const targetType of targetTypes) {
      const targets = context.allEntities().filter(entity => entity.type === targetType);
      for (const source of sources) {
        for (const target of targets) {
          if (source.id === target.id) continue;
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

  _dedupeRelationships(context) {
    const seen = new Set();
    context.relationships = context.relationships.filter(relationship => {
      const key = `${relationship.type}:${relationship.source?.id || relationship.source?.value}:${relationship.target?.id || relationship.target?.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

module.exports = EntityRelationshipBuilder;
