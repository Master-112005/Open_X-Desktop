'use strict';

class VisualQueryContext {
  constructor(input = {}) {
    this.rawInput = String(input.rawInput || input.pipelineContext?.rawInput || '');
    this.normalizedInput = String(
      input.normalizedInput ||
      input.pipelineContext?.getCommandInput?.() ||
      input.pipelineContext?.normalizedInput ||
      this.rawInput
    );
    this.source = String(input.source || input.pipelineContext?.source || 'chat');
    this.intent = input.intent || input.pipelineContext?.reasoningResult?.resolvedIntent?.intent || null;
    this.semanticRepresentation = input.semanticRepresentation || input.pipelineContext?.semanticRepresentation || null;
    this.structuredEntities = input.structuredEntities || input.pipelineContext?.structuredEntities || null;
    this.resolvedContext = input.resolvedContext || input.pipelineContext?.resolvedContext || null;
    this.conversationState = input.conversationState || input.pipelineContext?.options?.conversation || null;
    this.memory = input.memory || this.resolvedContext?.conversationMemory || null;
    this.metadata = {
      ...(input.metadata || {}),
      ...(input.pipelineContext?.metadata || {})
    };
  }

  getText() {
    return String(this.normalizedInput || this.rawInput || '').trim();
  }

  getEntities(collection) {
    const value = this.structuredEntities?.[collection];
    return Array.isArray(value) ? value : [];
  }

  getSemanticConcepts() {
    return Array.isArray(this.semanticRepresentation?.concepts) ? this.semanticRepresentation.concepts : [];
  }
}

module.exports = VisualQueryContext;
