'use strict';

const PipelineStage = require('../pipeline/PipelineStage');
const StageResult = require('../pipeline/StageResult');
const { createDefaultVerificationResponseManager } = require('./VerificationResponseManager');

class VerificationResponseStage extends PipelineStage {
  constructor(options = {}) {
    super({
      id: options.id || 'assistant.verification.response',
      name: options.name || 'Assistant Verification and Response',
      order: Number.isFinite(options.order) ? options.order : -0.25,
      enabled: options.enabled !== false
    });
    this.manager = options.manager || createDefaultVerificationResponseManager({
      configuration: options.configuration || {}
    });
  }

  async execute(context) {
    if (!context.automationResult) {
      return StageResult.skipped(this.id, 'No AutomationResult available.');
    }
    const { verificationResult, assistantResponse } = await this.manager.run(context.automationResult, {
      metadata: {
        ...(context.metadata || {}),
        rawInput: context.rawInput,
        source: context.source
      }
    });
    context.verificationResult = verificationResult;
    context.assistantResponse = assistantResponse;
    context.set('assistant.verificationResult', verificationResult);
    context.set('assistant.assistantResponse', assistantResponse);
    return StageResult.ok(this.id, {
      executionStatus: verificationResult.executionStatus,
      responseType: assistantResponse.responseType,
      version: assistantResponse.version
    });
  }

  async destroy() {
    this.manager.destroy?.();
    return super.destroy();
  }
}

module.exports = VerificationResponseStage;
