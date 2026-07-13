'use strict';

const MemoryConfiguration = require('./MemoryConfiguration');
const MemoryRegistry = require('./MemoryRegistry');
const MemoryPipeline = require('./MemoryPipeline');
const WorkingMemory = require('./WorkingMemory');
const ConversationMemory = require('./ConversationMemory');
const SessionMemory = require('./SessionMemory');
const DialogueHistory = require('./DialogueHistory');
const LongTermMemory = require('./LongTermMemory');
const TopicTracker = require('./TopicTracker');
const ReferenceResolver = require('../references/ReferenceResolver');
const PronounResolver = require('../references/PronounResolver');
const AliasResolver = require('../references/AliasResolver');
const ConversationResolver = require('../references/ConversationResolver');
const ContextResolver = require('../references/ContextResolver');
const ReferenceGraphBuilder = require('../references/ReferenceGraphBuilder');
const ApplicationContext = require('../context/ApplicationContext');
const DesktopContext = require('../context/DesktopContext');
const BrowserContext = require('../context/BrowserContext');
const ScreenContext = require('../context/ScreenContext');
const ClipboardContext = require('../context/ClipboardContext');
const SystemContext = require('../context/SystemContext');
const CalendarContext = require('../context/CalendarContext');
const MediaContext = require('../context/MediaContext');
const TimeContext = require('../context/TimeContext');
const UserContext = require('../context/UserContext');
const SelectionContext = require('../context/SelectionContext');
const WindowContext = require('../context/WindowContext');

class MemoryManager {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof MemoryConfiguration
      ? options.configuration
      : new MemoryConfiguration(options.configuration || options);
    this.registry = options.registry || new MemoryRegistry();
    this.pipeline = options.pipeline || null;
    this.state = options.state || {};
    this.logger = options.logger || null;
    this.defaultProvidersRegistered = false;
    if (options.defaultProviders !== false) this._registerDefaults();
  }

  _registerDefaults() {
    if (this.defaultProvidersRegistered) return;
    [
      [WorkingMemory, 'memory.workingMemory', 'memoryProviders', 10],
      [ConversationMemory, 'memory.conversationMemory', 'memoryProviders', 20],
      [SessionMemory, 'memory.sessionMemory', 'memoryProviders', 30],
      [DialogueHistory, 'memory.dialogueHistory', 'memoryProviders', 40],
      [TopicTracker, 'memory.topicTracker', 'memoryProviders', 50],
      [LongTermMemory, 'memory.longTermMemory', 'memoryProviders', 55],
      [ReferenceResolver, 'reference.resolver', 'referenceResolvers', 60],
      [PronounResolver, 'reference.pronounResolver', 'referenceResolvers', 70],
      [AliasResolver, 'reference.aliasResolver', 'referenceResolvers', 80],
      [ConversationResolver, 'reference.conversationResolver', 'referenceResolvers', 90],
      [ContextResolver, 'reference.contextResolver', 'referenceResolvers', 100],
      [ReferenceGraphBuilder, 'reference.graphBuilder', 'referenceResolvers', 105],
      [ApplicationContext, 'context.application', 'contextProviders', 110],
      [DesktopContext, 'context.desktop', 'contextProviders', 120],
      [BrowserContext, 'context.browser', 'contextProviders', 130],
      [ScreenContext, 'context.screen', 'contextProviders', 140],
      [ClipboardContext, 'context.clipboard', 'contextProviders', 150],
      [SystemContext, 'context.system', 'contextProviders', 160],
      [CalendarContext, 'context.calendar', 'contextProviders', 170],
      [MediaContext, 'context.media', 'contextProviders', 180],
      [TimeContext, 'context.time', 'contextProviders', 190],
      [UserContext, 'context.user', 'contextProviders', 200],
      [SelectionContext, 'context.selection', 'contextProviders', 210],
      [WindowContext, 'context.window', 'contextProviders', 220]
    ].forEach(([Ctor, id, group, priority]) => {
      const target = group === 'memoryProviders'
        ? this.registry.memoryProviders
        : group === 'referenceResolvers'
          ? this.registry.referenceResolvers
          : this.registry.contextProviders;
      if (target?.has(id)) return;
      const configured = this.configuration.getProviderOptions(group, id, { priority });
      const instance = new Ctor({ id, ...configured, aliases: this.configuration.aliases });
      if (group === 'memoryProviders') this.registry.registerMemoryProvider(instance, { id, priority: configured.priority, enabled: configured.enabled });
      if (group === 'referenceResolvers') this.registry.registerReferenceResolver(instance, { id, priority: configured.priority, enabled: configured.enabled });
      if (group === 'contextProviders') this.registry.registerContextProvider(instance, { id, priority: configured.priority, enabled: configured.enabled });
    });
    this.defaultProvidersRegistered = true;
  }

  registerMemoryProvider(provider, options = {}) { this.registry.registerMemoryProvider(provider, options); return this; }
  registerReferenceResolver(resolver, options = {}) { this.registry.registerReferenceResolver(resolver, options); return this; }
  registerContextProvider(provider, options = {}) { this.registry.registerContextProvider(provider, options); return this; }
  registerTopicProvider(provider, options = {}) { this.registry.registerTopicProvider(provider, options); return this; }

  async resolve(structuredEntities, options = {}) {
    if (!this.pipeline) {
      this.pipeline = new MemoryPipeline({
        registry: this.registry,
        configuration: this.configuration,
        state: this.state,
        logger: this.logger
      });
    }
    return this.pipeline.run(structuredEntities, options);
  }

  resetPipeline() {
    this.pipeline = null;
    return this;
  }

  clearState() {
    this.state = {};
    this.resetPipeline();
    return this;
  }

  getStatus() {
    return {
      enabled: this.configuration.enabled,
      version: this.configuration.version,
      counts: this.registry.counts(),
      stateKeys: Object.keys(this.state || {}),
      ...this.registry.health()
    };
  }

  async destroy() {
    for (const group of [this.registry.listMemoryProviders(), this.registry.listReferenceResolvers(), this.registry.listContextProviders()]) {
      for (const item of group) await item.destroy?.();
    }
    this.registry.clear();
    this.pipeline = null;
    this.state = {};
  }
}

function createDefaultMemoryManager(options = {}) {
  return new MemoryManager(options);
}

module.exports = { MemoryManager, createDefaultMemoryManager };
