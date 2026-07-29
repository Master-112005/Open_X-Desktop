'use strict';

const PipelineStage = require('../pipeline/PipelineStage');
const StageResult = require('../pipeline/StageResult');
const { createDefaultReasoningManager } = require('./ReasoningManager');

class GoalIntentReasoningStage extends PipelineStage {
  constructor(options = {}) {
    super({
      id: options.id || 'assistant.goalIntent.reasoning',
      name: options.name || 'Assistant Goal and Intent Reasoning',
      order: Number.isFinite(options.order) ? options.order : -2,
      enabled: options.enabled !== false
    });
    this.manager = options.manager || createDefaultReasoningManager({
      configuration: options.configuration || {},
      logger: options.logger || null
    });
  }

  async execute(context) {
    if (!context.resolvedContext) {
      return StageResult.skipped(this.id, 'No ResolvedContext available.');
    }
    const reasoningResult = await this.manager.reason(context.resolvedContext, {
      metadata: {
        ...(context.metadata || {}),
        rawInput: context.rawInput,
        source: context.source,
        structuredEntities: context.structuredEntities || context.get?.('assistant.structuredEntities') || null
      }
    });
    context.reasoningResult = reasoningResult;
    context.set('assistant.reasoningResult', reasoningResult);
    return StageResult.ok(this.id, {
      goal: reasoningResult.resolvedGoal?.id || null,
      intent: reasoningResult.resolvedIntent?.intent || null,
      action: reasoningResult.resolvedAction?.action || null,
      ready: reasoningResult.ready,
      entitySummary: reasoningResult.entitySummary,
      cognitive: reasoningResult.cognitiveReasoning ? {
        dimensions: (reasoningResult.cognitiveReasoning.dimensions || []).slice(0, 6).map(item => item.id),
        uncertainty: reasoningResult.cognitiveReasoning.uncertainty?.level || 'none',
        safety: reasoningResult.cognitiveReasoning.safety?.level || 'none',
        privacy: reasoningResult.cognitiveReasoning.privacy?.level || 'none'
      } : null,
      confidence: reasoningResult.confidenceScores.overall || 0,
      version: reasoningResult.version
    });
  }

  async destroy() {
    if (typeof this.manager?.destroy === 'function') this.manager.destroy();
    return super.destroy();
  }
}

module.exports = GoalIntentReasoningStage;
