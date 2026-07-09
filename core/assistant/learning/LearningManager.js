'use strict';

const LearningConfiguration = require('./LearningConfiguration');
const LearningRegistry = require('./LearningRegistry');
const LearningPipeline = require('./LearningPipeline');
const CorrectionLearning = require('./CorrectionLearning');
const AliasLearning = require('./AliasLearning');
const PreferenceLearning = require('./PreferenceLearning');
const HabitLearning = require('./HabitLearning');
const WorkflowLearning = require('./WorkflowLearning');
const ConversationLearning = require('./ConversationLearning');
const UsageLearning = require('./UsageLearning');
const PatternLearning = require('./PatternLearning');
const FeedbackLearning = require('./FeedbackLearning');

class LearningManager {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof LearningConfiguration
      ? options.configuration
      : new LearningConfiguration(options.configuration || options);
    this.registry = options.registry || new LearningRegistry();
    this.pipeline = options.pipeline || null;
    this.storage = options.storage || null;
    if (options.defaultModules !== false) this._registerDefaults();
  }

  _registerDefaults() {
    [
      [CorrectionLearning, 'learning.correction', 10],
      [AliasLearning, 'learning.alias', 20],
      [PreferenceLearning, 'learning.preference', 30],
      [HabitLearning, 'learning.habit', 40],
      [WorkflowLearning, 'learning.workflow', 50],
      [ConversationLearning, 'learning.conversation', 60],
      [UsageLearning, 'learning.usage', 70],
      [PatternLearning, 'learning.pattern', 80],
      [FeedbackLearning, 'learning.feedback', 90]
    ].forEach(([Ctor, id, priority]) => {
      const configured = this.configuration.getModuleOptions(id, { priority });
      this.registry.register(new Ctor({ id, ...configured }), { id, priority: configured.priority, enabled: configured.enabled });
    });
  }

  registerModule(module, options = {}) {
    this.registry.register(module, options);
    return this;
  }

  async learn(assistantResponse, options = {}) {
    if (!this.pipeline) {
      this.pipeline = new LearningPipeline({
        registry: this.registry,
        configuration: this.configuration,
        storage: this.storage || undefined
      });
    }
    return this.pipeline.run(assistantResponse, options);
  }

  getStatus() {
    return { enabled: this.configuration.enabled, version: this.configuration.version, modules: this.registry.health() };
  }

  destroy() {
    for (const module of this.registry.list()) module.destroy?.();
    this.registry.clear();
    this.pipeline = null;
  }
}

function createDefaultLearningManager(options = {}) {
  return new LearningManager(options);
}

module.exports = { LearningManager, createDefaultLearningManager };
