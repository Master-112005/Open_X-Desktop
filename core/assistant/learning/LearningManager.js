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
const PersonalPreferenceLearning = require('./PersonalPreferenceLearning');
const RoutineTimeLearning = require('./RoutineTimeLearning');
const DevicePreferenceLearning = require('./DevicePreferenceLearning');
const AppliancePatternLearning = require('./AppliancePatternLearning');
const ActionSequenceLearning = require('./ActionSequenceLearning');

class LearningManager {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof LearningConfiguration
      ? options.configuration
      : new LearningConfiguration(options.configuration || options);
    this.registry = options.registry || new LearningRegistry();
    this.pipeline = options.pipeline || null;
    this.storage = options.storage || null;
    this.defaultModulesRegistered = false;
    if (options.defaultModules !== false) this._registerDefaults();
  }

  _registerDefaults() {
    if (this.defaultModulesRegistered) return;
    [
      [CorrectionLearning, 'learning.correction', 10],
      [AliasLearning, 'learning.alias', 20],
      [PreferenceLearning, 'learning.preference', 30],
      [PersonalPreferenceLearning, 'learning.personal-preference', 35],
      [HabitLearning, 'learning.habit', 40],
      [RoutineTimeLearning, 'learning.routine-time', 42],
      [DevicePreferenceLearning, 'learning.device-preference', 44],
      [AppliancePatternLearning, 'learning.appliance-pattern', 46],
      [ActionSequenceLearning, 'learning.action-sequence', 48],
      [WorkflowLearning, 'learning.workflow', 50],
      [ConversationLearning, 'learning.conversation', 60],
      [UsageLearning, 'learning.usage', 70],
      [PatternLearning, 'learning.pattern', 80],
      [FeedbackLearning, 'learning.feedback', 90]
    ].forEach(([Ctor, id, priority]) => {
      if (this.registry.has(id)) return;
      const configured = this.configuration.getModuleOptions(id, { priority });
      this.registry.register(new Ctor({ id, ...configured }), { id, priority: configured.priority, enabled: configured.enabled });
    });
    this.defaultModulesRegistered = true;
  }

  registerModule(module, options = {}) {
    this.registry.register(module, options);
    this.pipeline = null;
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

  async learnExternalEvent(event, metadata = {}) {
    if (!this.pipeline) {
      this.pipeline = new LearningPipeline({
        registry: this.registry,
        configuration: this.configuration,
        storage: this.storage || undefined
      });
    }
    return this.pipeline.run(null, {
      externalEvent: event,
      metadata: {
        source: metadata.source || event?.source || 'external_event',
        ...metadata
      }
    });
  }

  getStatus() {
    if (!this.pipeline) {
      this.pipeline = new LearningPipeline({
        registry: this.registry,
        configuration: this.configuration,
        storage: this.storage || undefined
      });
    }
    return {
      enabled: this.configuration.enabled,
      version: this.configuration.version,
      moduleCount: this.registry.count({ includeDisabled: true }),
      activeModuleCount: this.registry.count({ includeDisabled: false }),
      configuration: this.configuration.toJSON(),
      personalization: this.pipeline.personalization?.summarize?.() || null,
      modules: this.registry.health()
    };
  }

  getPersonalizationProfile() {
    if (!this.pipeline) {
      this.pipeline = new LearningPipeline({
        registry: this.registry,
        configuration: this.configuration,
        storage: this.storage || undefined
      });
    }
    return this.pipeline.personalization?.snapshot?.() || null;
  }

  async destroy() {
    for (const module of this.registry.list()) await module.destroy?.();
    this.registry.clear();
    this.pipeline = null;
    this.defaultModulesRegistered = false;
  }
}

function createDefaultLearningManager(options = {}) {
  return new LearningManager(options);
}

module.exports = { LearningManager, createDefaultLearningManager };
