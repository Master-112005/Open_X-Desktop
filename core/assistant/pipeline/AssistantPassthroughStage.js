'use strict';

const PipelineStage = require('./PipelineStage');
const StageResult = require('./StageResult');

class AssistantPassthroughStage extends PipelineStage {
  constructor(options = {}) {
    super({
      id: options.id || 'assistant.input.passThrough',
      name: options.name || 'Assistant Input Pass-through',
      order: Number.isFinite(options.order) ? options.order : 0,
      enabled: options.enabled !== false
    });
  }

  execute(context) {
    const text = typeof context.normalizedInput === 'string' ? context.normalizedInput : context.rawInput;
    const output = {
      input: text,
      source: context.source,
      options: { ...(context.options || {}) }
    };
    context.set('assistant.request', output);
    context.setStageOutput(this.id, output);
    return StageResult.ok(this.id, output);
  }
}

module.exports = AssistantPassthroughStage;
