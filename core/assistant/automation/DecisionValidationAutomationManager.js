'use strict';

const { createDefaultDecisionManager } = require('../decision');
const { createDefaultValidationManager } = require('../validation');
const AutomationDispatcher = require('./AutomationDispatcher');

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
    const metadata = options.metadata || {};
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

module.exports = {
  DecisionValidationAutomationManager,
  createDefaultDecisionValidationAutomationManager
};
