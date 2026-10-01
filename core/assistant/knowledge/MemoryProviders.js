'use strict';

class BaseMemoryProvider {
  constructor(options = {}) {
    this.id = String(options.id || this.constructor.name);
    this.name = String(options.name || this.id);
    this.priority = Number.isFinite(options.priority) ? Number(options.priority) : 100;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.options = { ...(options || {}) };
    this.initialized = false;
    this.stats = { runs: 0, failures: 0, skips: 0, lastRunAt: null };
  }

  initialize() {
    this.initialized = true;
    return true;
  }

  supports(context) {
    return this.enabled && !!context;
  }

  markRun(result = {}) {
    this.stats.runs += 1;
    if (result.skipped) this.stats.skips += 1;
    if (result.success === false) this.stats.failures += 1;
    this.stats.lastRunAt = Date.now();
    return this.stats;
  }

  describe() {
    return {
      id: this.id,
      name: this.name,
      priority: this.priority,
      enabled: this.enabled,
      version: this.version,
      initialized: this.initialized,
      stats: { ...this.stats }
    };
  }

  apply(context) {
    return context;
  }

  cleanup() {
    return true;
  }

  destroy() {
    this.initialized = false;
    return true;
  }
}

class WorkingMemory extends BaseMemoryProvider {
  apply(context) {
    const now = Date.now();
    const ttlMs = Number(this.options.ttlMs || context.configuration?.workingMemoryTtlMs || 30 * 60 * 1000);
    const store = context.state.workingMemory || { values: {}, updatedAt: now };
    if (now - Number(store.updatedAt || 0) > ttlMs) {
      store.values = {};
    }

    const app = context.latestEntity(['application']);
    const file = context.latestEntity(['file', 'path']);
    const browser = context.latestEntity(['browser']);
    const selection = context.snapshots.selection || null;
    if (app) store.values.currentApplication = app.canonical || app.value;
    if (file) store.values.currentFile = file.canonical || file.value;
    if (browser) store.values.currentBrowser = browser.canonical || browser.value;
    if (selection) store.values.currentSelection = selection;
    store.values.currentCommand = context.input || store.values.currentCommand || '';
    store.values.currentSource = context.metadata.source || store.values.currentSource || 'chat';
    store.values.lastEntityTypes = context.entities.map(entity => entity.type).slice(-10);
    store.updatedAt = now;
    context.state.workingMemory = store;
    context.workingMemory = {
      ...store.values,
      updatedAt: store.updatedAt,
      expiresAt: store.updatedAt + ttlMs
    };
    return context;
  }
}

class ConversationMemory extends BaseMemoryProvider {
  apply(context) {
    const limit = Number(this.options.limit || context.configuration?.memoryLimit || 50);
    const history = context.state.conversationTurns || [];
    const turn = {
      input: context.input,
      entities: context.entitySnapshot(limit),
      source: context.metadata.source || context.structuredEntities?.metadata?.source || 'chat',
      timestamp: Date.now()
    };
    history.push(turn);
    context.state.conversationTurns = history.slice(-limit);
    context.conversationMemory = {
      turns: context.state.conversationTurns.slice(),
      previousTurn: context.state.conversationTurns.length > 1
        ? context.state.conversationTurns[context.state.conversationTurns.length - 2]
        : null,
      references: context.state.conversationTurns.flatMap(item => item.entities).slice(-limit)
    };
    context.futureExtensions.conversation = {
      turnCount: context.conversationMemory.turns.length,
      referenceCount: context.conversationMemory.references.length
    };
    return context;
  }
}

class SessionMemory extends BaseMemoryProvider {
  apply(context) {
    const limit = Number(this.options.limit || context.configuration?.memoryLimit || 50);
    const session = context.state.sessionMemory || {
      startedAt: Date.now(),
      recentApplications: [],
      recentFiles: [],
      recentBrowsers: [],
      temporaryVariables: {}
    };
    for (const entity of context.entities) {
      if (entity.type === 'application') session.recentApplications.push(entity.canonical || entity.value);
      if (entity.type === 'file' || entity.type === 'path') session.recentFiles.push(entity.canonical || entity.value);
      if (entity.type === 'browser') session.recentBrowsers.push(entity.canonical || entity.value);
    }
    session.recentApplications = Array.from(new Set(session.recentApplications)).slice(-limit);
    session.recentFiles = Array.from(new Set(session.recentFiles)).slice(-limit);
    session.recentBrowsers = Array.from(new Set(session.recentBrowsers)).slice(-limit);
    session.lastCommand = context.input || session.lastCommand || '';
    session.updatedAt = Date.now();
    context.state.sessionMemory = session;
    context.sessionMemory = { ...session };
    return context;
  }
}

class DialogueHistory extends BaseMemoryProvider {
  apply(context) {
    const limit = Number(this.options.limit || context.configuration?.memoryLimit || 50);
    const history = context.state.dialogueHistory || [];
    history.push({
      role: 'user',
      text: context.input,
      timestamp: Date.now(),
      entityCount: context.entities.length,
      topic: context.topic?.label || context.state.lastTopic?.label || null,
      source: context.metadata.source || 'chat'
    });
    context.state.dialogueHistory = history.slice(-limit);
    context.dialogueHistory = context.state.dialogueHistory.slice();
    return context;
  }
}

const TOPIC_TYPES = new Set(['media', 'website', 'application', 'browser', 'file', 'folder', 'contact', 'person', 'device']);

class TopicTracker extends BaseMemoryProvider {
  apply(context) {
    const topicEntity = context.entities.slice().reverse().find(entity => TOPIC_TYPES.has(entity.type));
    const topic = topicEntity
      ? {
          label: topicEntity.canonical || topicEntity.value,
          type: topicEntity.type,
          confidence: topicEntity.confidence,
          timestamp: Date.now()
        }
      : context.state.lastTopic || null;
    context.topic = topic;
    if (topic) context.state.lastTopic = topic;
    context.futureExtensions.topic = topic ? {
      label: topic.label,
      type: topic.type,
      ageMs: Math.max(0, Date.now() - Number(topic.timestamp || Date.now()))
    } : null;
    return context;
  }
}

class LongTermMemory extends BaseMemoryProvider {
  apply(context) {
    const source = context.configuration?.longTermMemory || this.options.source || {};
    const reader = typeof source.read === 'function' ? source.read.bind(source) : null;
    const value = reader ? reader({
      entities: context.entitySnapshot(),
      input: context.input,
      topic: context.topic
    }) : { ...(source || {}) };
    context.longTermMemory = value && typeof value === 'object' ? { ...value } : {};
    context.futureExtensions.longTermMemory = {
      available: Boolean(context.longTermMemory && Object.keys(context.longTermMemory).length),
      keys: Object.keys(context.longTermMemory || {}).slice(0, 20)
    };
    return context;
  }
}

module.exports = {
  BaseMemoryProvider,
  WorkingMemory,
  ConversationMemory,
  SessionMemory,
  DialogueHistory,
  TopicTracker,
  LongTermMemory
};