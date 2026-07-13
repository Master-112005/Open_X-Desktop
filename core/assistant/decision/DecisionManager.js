'use strict';

const DecisionConfiguration = require('./DecisionConfiguration');
const DecisionRegistry = require('./DecisionRegistry');
const DecisionPipeline = require('./DecisionPipeline');
const DecisionEngine = require('./DecisionEngine');
const ExecutionDecision = require('./ExecutionDecision');
const ClarificationDecision = require('./ClarificationDecision');
const ConfirmationDecision = require('./ConfirmationDecision');
const PolicyDecision = require('./PolicyDecision');
const ConflictDecision = require('./ConflictDecision');

class DecisionManager {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof DecisionConfiguration
      ? options.configuration
      : new DecisionConfiguration(options.configuration || options);
    this.registry = options.registry || new DecisionRegistry();
    this.pipeline = options.pipeline || null;
    if (options.defaultDecisions !== false) this._registerDefaults();
  }

  _registerDefaults() {
    [
      [DecisionEngine, 'decision.engine', 10],
      [ExecutionDecision, 'decision.execution', 20],
      [ClarificationDecision, 'decision.clarification', 30],
      [ConfirmationDecision, 'decision.confirmation', 40],
      [PolicyDecision, 'decision.policy', 50],
      [ConflictDecision, 'decision.conflict', 60]
    ].forEach(([Ctor, id, priority]) => {
      const configured = this.configuration.getDecisionOptions(id, { priority });
      this.registry.register(new Ctor({ id, ...configured }), { id, priority: configured.priority, enabled: configured.enabled });
    });
  }

  registerDecision(decision, options = {}) {
    this.registry.register(decision, options);
    return this;
  }

  async decide(executionBlueprint, options = {}) {
    if (!this.pipeline) {
      this.pipeline = new DecisionPipeline({
        registry: this.registry,
        configuration: this.configuration
      });
    }
    return this.pipeline.run(executionBlueprint, {
      ...(options || {}),
      metadata: {
        ...(options.metadata || {}),
        decisionManagerVersion: this.configuration.version
      }
    });
  }

  getStatus() {
    return {
      enabled: this.configuration.enabled,
      version: this.configuration.version,
      pipelineReady: Boolean(this.pipeline),
      decisionCount: this.registry.list().length,
      decisions: this.registry.health()
    };
  }

  destroy() {
    for (const decision of this.registry.list()) decision.destroy?.();
    this.registry.clear();
    this.pipeline = null;
  }
}

function createDefaultDecisionManager(options = {}) {
  return new DecisionManager(options);
}

module.exports = { DecisionManager, createDefaultDecisionManager };
