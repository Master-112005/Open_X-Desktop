'use strict';

const PipelineStage = require('../pipeline/PipelineStage');
const StageResult = require('../pipeline/StageResult');

class AssistantExecutionStage extends PipelineStage {
  constructor(options = {}) {
    super({
      id: options.id || 'assistant.execution',
      name: options.name || 'Assistant Execution',
      order: Number.isFinite(options.order) ? options.order : 0.1,
      enabled: options.enabled !== false
    });
    this.executor = options.executor || null;
  }

  async execute(context) {
    if (typeof this.executor !== 'function') {
      return StageResult.skipped(this.id, 'No assistant executor configured.');
    }

    const commandIntentText = context.get?.('assistant.commandIntentText') || context.normalizedInputObject?.commandIntentText || context.normalizedInputObject?.metadata?.commandIntentText;
    const normalized = String(commandIntentText || context.normalizedInputObject?.normalizedText || '').trim();
    const input = normalized
      ? normalized
      : context.normalizedInput || context.rawInput;
    const options = {
      ...(context.options || {}),
      pipelineContext: context
    };

    const result = await this.executor(input, context.source, options);
    context.set('assistant.result', result);
    context.set('assistant.responsePayload', result);
    context.setStageOutput(this.id, result);
    return StageResult.ok(this.id, result);
  }
}

module.exports = AssistantExecutionStage;
