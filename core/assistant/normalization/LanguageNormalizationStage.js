'use strict';

const PipelineStage = require('../pipeline/PipelineStage');
const StageResult = require('../pipeline/StageResult');
const { createDefaultNormalizationManager } = require('./NormalizationManager');

class LanguageNormalizationStage extends PipelineStage {
  constructor(options = {}) {
    super({
      id: options.id || 'assistant.language.normalization',
      name: options.name || 'Assistant Language Normalization',
      order: Number.isFinite(options.order) ? options.order : -100,
      enabled: options.enabled !== false
    });
    this.manager = options.manager || createDefaultNormalizationManager({
      configuration: options.configuration || {},
      logger: options.logger || null
    });
  }

  async execute(context) {
    const rawUserInput = context.rawUserInput || {
      rawText: context.rawInput,
      source: context.source,
      requestId: context.requestId,
      conversationId: context.conversationId,
      metadata: context.metadata,
      options: context.options
    };
    const normalizedInput = await this.manager.normalize(rawUserInput, { metadata: context.metadata });
    context.normalizedInput = normalizedInput.normalizedText;
    context.normalizedInputObject = normalizedInput;
    context.set('assistant.normalizedInput', normalizedInput);
    return StageResult.ok(this.id, {
      input: normalizedInput.normalizedText,
      source: context.source,
      options: { ...(context.options || {}) },
      normalizedInput: {
        normalizedText: normalizedInput.normalizedText,
        normalizationVersion: normalizedInput.normalizationVersion,
        historyCount: normalizedInput.normalizationHistory.length
      }
    });
  }

  async destroy() {
    if (typeof this.manager?.destroy === 'function') this.manager.destroy();
    return super.destroy();
  }
}

module.exports = LanguageNormalizationStage;
