'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

class ReferenceGraphBuilder {
  constructor(options = {}) {
    this.id = String(options.id || 'reference.graphBuilder');
    this.priority = Number.isFinite(options.priority) ? options.priority : 105;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.initialized = false;
  }

  initialize() {
    this.initialized = true;
  }

  resolve(context) {
    context.futureExtensions.referenceGraph = deepFreeze({
      nodes: context.resolvedReferences.flatMap((item, index) => [
        { id: `reference:${index + 1}`, type: 'reference', value: item.reference || item.alias },
        { id: `target:${index + 1}`, type: item.targetType || 'target', value: item.target }
      ]),
      edges: context.resolvedReferences.map((item, index) => ({
        from: `reference:${index + 1}`,
        to: `target:${index + 1}`,
        confidence: item.confidence
      }))
    });
    return context;
  }
}

module.exports = ReferenceGraphBuilder;
