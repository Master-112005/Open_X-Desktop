'use strict';

const PipelineBuilder = require('./PipelineBuilder');
const AssistantPassthroughStage = require('./AssistantPassthroughStage');
const { LanguageNormalizationStage } = require('../normalization');
const { LinguisticUnderstandingStage } = require('../linguistic');
const { SemanticUnderstandingStage } = require('../semantic');
const { EntityUnderstandingStage } = require('../entities/index.js');
const { MemoryContextStage } = require('../memory/index.js');
const { GoalIntentReasoningStage } = require('../reasoning/index.js');
const { TaskPlanningStage } = require('../planning/index.js');
const { DecisionValidationAutomationStage } = require('../automation/index.js');
const { VerificationResponseStage } = require('../verification/index.js');
const { LearningStage } = require('../learning/index.js');

class PipelineManager {
  constructor(options = {}) {
    this.builder = options.builder || new PipelineBuilder(options);
    this.engine = options.engine || null;
    this.started = false;
    if (options.defaultStages !== false) {
      this.builder.registerStage(new LanguageNormalizationStage({
        configuration: options.normalization || options.configuration?.normalization || {},
        logger: options.logger || null
      }), { id: 'assistant.language.normalization', order: -100 });
      this.builder.registerStage(new LinguisticUnderstandingStage({
        configuration: options.linguistic || options.configuration?.linguistic || {},
        logger: options.logger || null
      }), { id: 'assistant.linguistic.understanding', order: -50 });
      this.builder.registerStage(new SemanticUnderstandingStage({
        configuration: options.semantic || options.configuration?.semantic || {},
        logger: options.logger || null
      }), { id: 'assistant.semantic.understanding', order: -25 });
      this.builder.registerStage(new EntityUnderstandingStage({
        configuration: options.entities || options.configuration?.entities || {},
        logger: options.logger || null
      }), { id: 'assistant.entity.understanding', order: -10 });
      this.builder.registerStage(new MemoryContextStage({
        configuration: options.memory || options.configuration?.memory || {},
        logger: options.logger || null
      }), { id: 'assistant.memory.context', order: -5 });
      this.builder.registerStage(new GoalIntentReasoningStage({
        configuration: options.reasoning || options.configuration?.reasoning || {},
        logger: options.logger || null
      }), { id: 'assistant.goalIntent.reasoning', order: -2 });
      this.builder.registerStage(new TaskPlanningStage({
        configuration: options.planning || options.configuration?.planning || {},
        logger: options.logger || null
      }), { id: 'assistant.task.planning', order: -1 });
      this.builder.registerStage(new DecisionValidationAutomationStage({
        configuration: options.decisionAutomation || options.configuration?.decisionAutomation || {},
        automationEngine: options.automationEngine || null,
        logger: options.logger || null
      }), { id: 'assistant.decision.validation.automation', order: -0.5 });
      this.builder.registerStage(new VerificationResponseStage({
        configuration: options.verificationResponse || options.configuration?.verificationResponse || {},
        logger: options.logger || null
      }), { id: 'assistant.verification.response', order: -0.25 });
      this.builder.registerStage(new AssistantPassthroughStage(), { id: 'assistant.input.passThrough', order: 0 });
      this.builder.registerStage(new LearningStage({
        configuration: options.learning || options.configuration?.learning || {},
        logger: options.logger || null
      }), { id: 'assistant.learning', order: 0.25 });
    }
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
        sourceType: rawUserInput?.sourceType || source,
        acquisitionConfidence: rawUserInput?.confidence
      }
    });
  }

  stop() {
    this.started = false;
    return this;
  }

  getStatus() {
    return {
      started: this.started,
      running: this.engine?.running === true,
      stages: this.builder.registry.list().map(stage => ({
        id: stage.id,
        name: stage.name,
        order: stage.order,
        enabled: stage.enabled !== false
      }))
    };
  }

  destroy() {
    this.stop();
    this.builder.registry.clear();
    this.engine = null;
  }
}

module.exports = PipelineManager;
