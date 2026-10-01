'use strict';

const PipelineStage = require('../pipeline/PipelineStage');
const StageResult = require('../pipeline/StageResult');
const { createDefaultDecisionManager } = require('../reasoning');
const { createDefaultValidationManager } = require('../respond');
const { AutomationDispatcher } = require('./AutomationRuntime');

class DecisionValidationAutomationManager {
  constructor(options = {}) {
    this.decisionManager = options.decisionManager || createDefaultDecisionManager({
      configuration: options.decision || options.configuration?.decision || {}
    });
    this.validationManager = options.validationManager || createDefaultValidationManager({
      configuration: options.validation || options.configuration?.validation || {}
    });
    this.dispatcher = options.dispatcher || new AutomationDispatcher({
      ...(options.automation || options.configuration?.automation || {}),
      automationEngine: options.automationEngine || null
    });
    this.automationEngine = options.automationEngine || null;
  }

  async run(executionBlueprint, options = {}) {
    const metadata = {
      ...(options.metadata || {}),
      automationRoutes: this.dispatcher.configuration.routes
    };
    const automationEngine = options.automationEngine || this.automationEngine || null;
    const decision = await this.decisionManager.decide(executionBlueprint, { metadata });
    const validation = await this.validationManager.validate(executionBlueprint, decision, {
      metadata,
      automationEngine
    });
    return this.dispatcher.dispatch(executionBlueprint, decision, validation, {
      metadata,
      automationEngine,
      executionContext: options.executionContext || {}
    });
  }

  getStatus() {
    return {
      decision: this.decisionManager.getStatus(),
      validation: this.validationManager.getStatus(),
      automation: {
        execute: this.dispatcher.configuration.execute,
        hasAutomationEngine: Boolean(this.automationEngine || this.dispatcher.automationEngine)
      }
    };
  }

  destroy() {
    this.decisionManager.destroy?.();
    this.validationManager.destroy?.();
  }
}

function createDefaultDecisionValidationAutomationManager(options = {}) {
  return new DecisionValidationAutomationManager(options);
}

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

module.exports = {
  DecisionValidationAutomationManager,
  DecisionValidationAutomationStage,
  createDefaultDecisionValidationAutomationManager
};