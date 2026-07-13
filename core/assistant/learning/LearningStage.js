'use strict';

const PipelineStage = require('../pipeline/PipelineStage');
const StageResult = require('../pipeline/StageResult');
const { createDefaultLearningManager } = require('./LearningManager');

class LearningStage extends PipelineStage {
  constructor(options = {}) {
    super({
      id: options.id || 'assistant.learning',
      name: options.name || 'Assistant Learning Engine',
      order: Number.isFinite(options.order) ? options.order : 0.25,
      enabled: options.enabled !== false
    });
    this.manager = options.manager || createDefaultLearningManager({
      configuration: options.configuration || {}
    });
  }

  async execute(context) {
    const finalOutput = context.get('assistant.result') || context.get('assistant.responsePayload') || {
      input: context.normalizedInput || context.rawInput,
      source: context.source,
      options: { ...(context.options || {}) }
    };
    if (!context.assistantResponse) {
      return StageResult.ok(this.id, finalOutput);
    }
    const learningResult = await this.manager.learn(context.assistantResponse, {
      metadata: {
        ...(context.metadata || {}),
        rawInput: context.rawInput,
        source: context.source
      }
    });
    context.learningResult = learningResult;
    context.set('assistant.learningResult', learningResult);
    if (
      context.assistantResponse &&
      typeof context.assistantResponse === 'object' &&
      Object.isExtensible(context.assistantResponse)
    ) {
      context.assistantResponse.learningResult = learningResult;
    }
    return StageResult.ok(this.id, finalOutput);
  }

  async destroy() {
    await this.manager.destroy?.();
    return super.destroy();
  }
}

module.exports = LearningStage;
