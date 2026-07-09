'use strict';

class AssistantEngine {
  constructor(options = {}) {
    this.inputSourceManager = options.inputSourceManager;
    this.pipeline = options.pipeline;
    this.logger = options.logger || null;
    this.executeLegacy = options.executeLegacy;
  }

  async processCommand(input, source = 'chat', options = {}) {
    const rawUserInput = this.inputSourceManager.acquire(input, source, options);
    const pipelineResult = await this.pipeline.process({ input, source, options, rawUserInput });
    if (!pipelineResult.success) {
      this.logger?.warn?.('Assistant Intelligence pipeline failed; continuing with original input.', pipelineResult.error?.message || 'unknown');
    }
    const forwarded = pipelineResult?.output && typeof pipelineResult.output === 'object'
      ? pipelineResult.output
      : {};
    const nextInput = typeof forwarded.input === 'string' ? forwarded.input : input;
    const nextSource = typeof forwarded.source === 'string' ? forwarded.source : source;
    const nextOptions = forwarded.options && typeof forwarded.options === 'object' ? forwarded.options : options;
    return this.executeLegacy(nextInput, nextSource, nextOptions);
  }

  getStatus() {
    return {
      pipeline: this.pipeline?.getStatus?.() || null
    };
  }

  destroy() {
    this.pipeline?.destroy?.();
  }
}

module.exports = AssistantEngine;
