'use strict';

const PipelineBuilder = require('./PipelineBuilder');
const { LanguageNormalizationStage } = require('../normalization');
const { LinguisticUnderstandingStage } = require('../linguistic');
const { SemanticUnderstandingStage } = require('../semantic');
const { EntityUnderstandingStage } = require('../entities/index.js');
const { MemoryContextStage } = require('../memory/index.js');
const { VisualQueryUnderstandingStage } = require('../capabilities/visual-memory/runtime/query');
const { CandidateFilteringStage } = require('../capabilities/visual-memory/runtime/filtering');
const { MemoryIntelligenceStage } = require('../capabilities/visual-memory/runtime/intelligence');
const { VisualMemoryCapabilityStage } = require('../capabilities');
const { GoalIntentReasoningStage } = require('../reasoning/index.js');
const { TaskPlanningStage } = require('../planning/index.js');
const { AssistantExecutionStage, DecisionValidationAutomationStage } = require('../automation/index.js');
const { VerificationResponseStage } = require('../verification/index.js');
const { LearningStage } = require('../learning/index.js');

class PipelineManager {
  constructor(options = {}) {
    this.builder = options.builder || new PipelineBuilder(options);
    this.engine = options.engine || null;
    this.started = false;
    this.options = { ...(options || {}) };
    this.defaultStagesRegistered = false;
    if (options.defaultStages !== false) {
      this.registerDefaultStages(options);
    }
  }

  registerDefaultStages(options = this.options) {
    if (this.defaultStagesRegistered) return this;
    const logger = options.logger || null;
    const configuration = options.configuration || {};
    const stages = [
      [new LanguageNormalizationStage({ configuration: options.normalization || configuration.normalization || {}, logger }), { id: 'assistant.language.normalization', order: -100 }],
      [new LinguisticUnderstandingStage({ configuration: options.linguistic || configuration.linguistic || {}, logger }), { id: 'assistant.linguistic.understanding', order: -50 }],
      [new SemanticUnderstandingStage({ configuration: options.semantic || configuration.semantic || {}, logger }), { id: 'assistant.semantic.understanding', order: -25 }],
      [new EntityUnderstandingStage({ configuration: options.entities || configuration.entities || {}, logger }), { id: 'assistant.entity.understanding', order: -10 }],
      [new MemoryContextStage({ configuration: options.memory || configuration.memory || {}, logger }), { id: 'assistant.memory.context', order: -5 }],
      [new VisualQueryUnderstandingStage({ configuration: options.visualQuery || configuration.visualQuery || {}, logger }), { id: 'assistant.visualQuery.understanding', order: -3 }],
      [new CandidateFilteringStage({ configuration: options.visualCandidateFiltering || configuration.visualCandidateFiltering || {}, visualMemoryApi: options.visualMemoryApi || null, logger }), { id: 'assistant.visualCandidate.filtering', order: -2.5 }],
      [new MemoryIntelligenceStage({ configuration: options.visualMemoryIntelligence || configuration.visualMemoryIntelligence || {}, visualMemoryApi: options.visualMemoryApi || null, logger }), { id: 'assistant.visualMemory.intelligence', order: -2.25 }],
      [new VisualMemoryCapabilityStage({ configuration: options.visualMemoryCapability || configuration.visualMemoryCapability || {}, visualMemoryApi: options.visualMemoryApi || null, logger }), { id: 'assistant.capability.visualMemory', order: -2.1 }],
      [new GoalIntentReasoningStage({ configuration: options.reasoning || configuration.reasoning || {}, logger }), { id: 'assistant.goalIntent.reasoning', order: -2 }],
      [new TaskPlanningStage({ configuration: options.planning || configuration.planning || {}, logger }), { id: 'assistant.task.planning', order: -1 }],
      [new DecisionValidationAutomationStage({
        configuration: options.decisionAutomation || configuration.decisionAutomation || {},
        automationEngine: options.automationEngine || null,
        logger
      }), { id: 'assistant.decision.validation.automation', order: -0.5 }],
      [new VerificationResponseStage({ configuration: options.verificationResponse || configuration.verificationResponse || {}, logger }), { id: 'assistant.verification.response', order: -0.25 }],
      [new AssistantExecutionStage({ executor: options.commandExecutor || options.executor || null, logger }), { id: 'assistant.execution', order: 0.1 }],
      [new LearningStage({ configuration: options.learning || configuration.learning || {}, logger }), { id: 'assistant.learning', order: 0.25 }]
    ];
    stages.forEach(([stage, stageOptions]) => {
      if (!this.builder.registry.has(stageOptions.id)) this.builder.registerStage(stage, stageOptions);
    });
    this.defaultStagesRegistered = true;
    return this;
  }

  start() {
    if (!this.engine) this.engine = this.builder.build();
    this.started = true;
    return this;
  }

  async process({ input = '', source = 'chat', options = {}, requestId = '', conversationId = '', rawUserInput = null } = {}) {
    if (!this.started) this.start();
    const text = rawUserInput?.rawText ?? input;
    return this.engine.run({
      requestId: requestId || rawUserInput?.requestId || '',
      conversationId: conversationId || rawUserInput?.conversationId || '',
      source: rawUserInput?.source || source,
      rawInput: text,
      normalizedInput: text,
      options,
      rawUserInput,
      metadata: {
        ...(options.pipelineMetadata || {}),
        sourceType: rawUserInput?.sourceType || source,
        acquisitionConfidence: rawUserInput?.confidence
      }
    });
  }

  configure(options = {}) {
    this.builder.configure(options);
    this.engine = null;
    if (this.started) this.start();
    return this;
  }

  getEngine() {
    if (!this.started) this.start();
    return this.engine;
  }

  stop() {
    this.started = false;
    return this;
  }

  getStatus() {
    return {
      started: this.started,
      running: this.engine?.running === true,
      stageCount: this.builder.registry.count(),
      stages: this.builder.registry.health(),
      builder: typeof this.builder.getStatus === 'function' ? this.builder.getStatus() : null
    };
  }

  async destroy() {
    this.stop();
    const stages = this.builder.registry.list();
    for (const stage of stages) {
      if (typeof stage.destroy === 'function') await stage.destroy();
    }
    this.builder.registry.clear();
    this.engine = null;
  }
}

module.exports = PipelineManager;
