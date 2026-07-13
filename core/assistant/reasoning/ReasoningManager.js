'use strict';

const ReasoningConfiguration = require('./ReasoningConfiguration');
const ReasoningRegistry = require('./ReasoningRegistry');
const ReasoningPipeline = require('./ReasoningPipeline');
const InferenceEngine = require('./InferenceEngine');
const GoalReasoner = require('./GoalReasoner');
const IntentReasoner = require('./IntentReasoner');
const ActionReasoner = require('./ActionReasoner');
const TaskReasoner = require('./TaskReasoner');
const ContextReasoner = require('./ContextReasoner');
const ConflictResolver = require('./ConflictResolver');
const ClarificationEngine = require('./ClarificationEngine');
const ConfidenceManager = require('./ConfidenceManager');
const ReasoningGraphBuilder = require('./ReasoningGraphBuilder');

class ReasoningManager {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof ReasoningConfiguration
      ? options.configuration
      : new ReasoningConfiguration(options.configuration || options);
    this.registry = options.registry || new ReasoningRegistry();
    this.pipeline = options.pipeline || null;
    this.logger = options.logger || null;
    if (options.defaultReasoners !== false) this._registerDefaults();
  }

  _registerDefaults() {
    [
      [InferenceEngine, 'reasoning.inferenceEngine', 10],
      [GoalReasoner, 'reasoning.goalReasoner', 20],
      [IntentReasoner, 'reasoning.intentReasoner', 30],
      [ActionReasoner, 'reasoning.actionReasoner', 40],
      [TaskReasoner, 'reasoning.taskReasoner', 50],
      [ContextReasoner, 'reasoning.contextReasoner', 60],
      [ConflictResolver, 'reasoning.conflictResolver', 70],
      [ClarificationEngine, 'reasoning.clarificationEngine', 80],
      [ConfidenceManager, 'reasoning.confidenceManager', 90],
      [ReasoningGraphBuilder, 'reasoning.graphBuilder', 100]
    ].forEach(([Ctor, id, priority]) => {
      const configured = this.configuration.getReasonerOptions(id, { priority });
      this.registry.register(new Ctor({ id, ...configured }), { id, priority: configured.priority, enabled: configured.enabled });
    });
  }

  registerReasoner(reasoner, options = {}) {
    this.registry.register(reasoner, options);
    return this;
  }

  async reason(resolvedContext, options = {}) {
    if (!this.pipeline) {
      this.pipeline = new ReasoningPipeline({
        registry: this.registry,
        configuration: this.configuration,
        logger: this.logger
      });
    }
    return this.pipeline.run(resolvedContext, options);
  }

  getStatus() {
    return {
      enabled: this.configuration.enabled,
      version: this.configuration.version,
      pipelineReady: Boolean(this.pipeline),
      reasonerCount: this.registry.list().length,
      reasoners: this.registry.health()
    };
  }

  destroy() {
    for (const reasoner of this.registry.list()) reasoner.destroy?.();
    this.registry.clear();
    this.pipeline = null;
  }
}

function createDefaultReasoningManager(options = {}) {
  return new ReasoningManager(options);
}

module.exports = { ReasoningManager, createDefaultReasoningManager };
