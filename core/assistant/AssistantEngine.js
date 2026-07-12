'use strict';

class AssistantEngine {
  constructor(options = {}) {
    this.inputSourceManager = options.inputSourceManager;
    this.pipeline = options.pipeline;
    this.logger = options.logger || null;
  }

  async processCommand(input, source = 'chat', options = {}) {
    const rawUserInput = this.inputSourceManager.acquire(input, source, options);
    const pipelineResult = await this.pipeline.process({ input, source, options, rawUserInput });
    if (!pipelineResult.success) {
      this.logger?.warn?.('Assistant Intelligence pipeline failed.', pipelineResult.error?.message || 'unknown');
      return {
        success: false,
        response: 'Sorry, I could not process that command.',
        source,
        error: pipelineResult.error?.message || 'Assistant Intelligence pipeline failed.'
      };
    }
    return pipelineResult.output;
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
