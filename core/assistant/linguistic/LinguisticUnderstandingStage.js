'use strict';

const PipelineStage = require('../pipeline/PipelineStage');
const StageResult = require('../pipeline/StageResult');
const { createDefaultLinguisticManager } = require('./LinguisticManager');
const NormalizedInput = require('../normalization/NormalizedInput');

class LinguisticUnderstandingStage extends PipelineStage {
  constructor(options = {}) {
    super({
      id: options.id || 'assistant.linguistic.understanding',
      name: options.name || 'Assistant Linguistic Understanding',
      order: Number.isFinite(options.order) ? options.order : -50,
      enabled: options.enabled !== false
    });
    this.manager = options.manager || createDefaultLinguisticManager({
      configuration: options.configuration || {},
      logger: options.logger || null
    });
  }

  async execute(context) {
    const normalizedInput = context.normalizedInputObject || new NormalizedInput({
      originalInput: context.rawUserInput,
      originalText: context.rawInput,
      normalizedText: context.normalizedInput || context.rawInput,
      language: context.rawUserInput?.language || null,
      locale: context.rawUserInput?.metadata?.locale || 'en-US'
    });
    const linguisticGraph = await this.manager.analyze(normalizedInput, { metadata: context.metadata });
    context.linguisticGraph = linguisticGraph;
    context.set('assistant.linguisticGraph', linguisticGraph);
    return StageResult.ok(this.id, {
      input: normalizedInput.normalizedText,
      source: context.source,
      options: { ...(context.options || {}) },
      linguisticGraph: {
        tokenCount: linguisticGraph.tokens.length,
        sentenceCount: linguisticGraph.sentences.length,
        clauseCount: linguisticGraph.clauses.length,
        dependencyCount: linguisticGraph.dependencies.length,
        questionCount: linguisticGraph.summary?.questionCount || 0,
        pronounCount: linguisticGraph.summary?.pronounCount || 0,
        linguisticVersion: linguisticGraph.linguisticVersion
      }
    });
  }

  async destroy() {
    if (typeof this.manager?.destroy === 'function') this.manager.destroy();
    return super.destroy();
  }
}

module.exports = LinguisticUnderstandingStage;
