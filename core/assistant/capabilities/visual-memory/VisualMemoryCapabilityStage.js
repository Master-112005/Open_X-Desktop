'use strict';

const PipelineStage = require('../../pipeline/PipelineStage');
const StageResult = require('../../pipeline/StageResult');
const VisualMemoryCapability = require('./capability/VisualMemoryCapability');

class VisualMemoryCapabilityStage extends PipelineStage {
  constructor(options = {}) {
    super({
      id: options.id || 'assistant.capability.visualMemory',
      name: options.name || 'Assistant Visual Memory Capability',
      order: Number.isFinite(options.order) ? options.order : -2.1,
      enabled: options.enabled !== false
    });
    this.capability = options.capability || new VisualMemoryCapability({
      configuration: options.configuration || options.visualMemoryCapability || {},
      visualMemoryApi: options.visualMemoryApi || options.api || null,
      logger: options.logger || null
    });
  }

  async initialize() {
    await this.capability.initialize();
    this.capability.register();
    return super.initialize();
  }

  async execute(context) {
    const output = await this.capability.handlePipelineContext(context);
    if (!output) {
      context.set('assistant.visualMemoryCapability.active', false);
      return StageResult.skipped(this.id, 'No Visual Memory capability route matched.');
    }
    context.visualMemoryCapability = output;
    context.set('assistant.visualMemoryCapability.active', true);
    context.set('assistant.visualMemoryCapability', output);
    return StageResult.ok(this.id, {
      capability: 'visual-memory',
      action: output.request.action,
      type: output.result.type,
      success: output.result.success === true,
      requiresVerification: output.result.requiresVerification === true,
      resultCount: output.response.resultCount,
      sessionId: output.session.id
    });
  }

  async destroy() {
    await this.capability.shutdown();
    return super.destroy();
  }
}

module.exports = VisualMemoryCapabilityStage;
