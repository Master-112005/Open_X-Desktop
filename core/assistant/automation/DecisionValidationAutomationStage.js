'use strict';

const PipelineStage = require('../pipeline/PipelineStage');
const StageResult = require('../pipeline/StageResult');
const { createDefaultDecisionValidationAutomationManager } = require('./DecisionValidationAutomationManager');

class DecisionValidationAutomationStage extends PipelineStage {
  constructor(options = {}) {
    super({
      id: options.id || 'assistant.decision.validation.automation',
      name: options.name || 'Assistant Decision, Validation, and Automation',
      order: Number.isFinite(options.order) ? options.order : -0.5,
      enabled: options.enabled !== false
    });
    this.manager = options.manager || createDefaultDecisionValidationAutomationManager({
      configuration: options.configuration || {},
      automationEngine: options.automationEngine || null
    });
  }

  async execute(context) {
    if (!context.executionBlueprint) {
      return StageResult.skipped(this.id, 'No ExecutionBlueprint available.');
    }
    const automationResult = await this.manager.run(context.executionBlueprint, {
      metadata: {
        ...(context.metadata || {}),
        rawInput: context.rawInput,
        source: context.source,
        confirmed: context.options?.confirmed === true
      },
      executionContext: {
        source: context.source,
        options: context.options || {}
      }
    });
    context.automationResult = automationResult;
    context.set('assistant.automationResult', automationResult);
    return StageResult.ok(this.id, {
      decision: automationResult.decision?.status || null,
      valid: automationResult.validation?.valid === true,
      executionStatus: automationResult.executionStatus,
      completedCount: automationResult.completedActions.length,
      failedCount: automationResult.failedActions.length,
      version: automationResult.version
    });
  }

  async destroy() {
    this.manager.destroy?.();
    return super.destroy();
  }
}

module.exports = DecisionValidationAutomationStage;
