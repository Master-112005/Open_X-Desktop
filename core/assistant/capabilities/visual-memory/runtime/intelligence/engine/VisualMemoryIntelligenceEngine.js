'use strict';

const MemoryIntelligenceConfiguration = require('../configuration/MemoryIntelligenceConfiguration');
const MemoryIntelligenceDiagnostics = require('../diagnostics/MemoryIntelligenceDiagnostics');
const { MemoryIntelligenceEventBus, MEMORY_INTELLIGENCE_EVENTS } = require('../events/MemoryIntelligenceEvents');
const MemoryIntelligenceLifecycle = require('../lifecycle/MemoryIntelligenceLifecycle');
const RelationshipIntelligence = require('../relationships/RelationshipIntelligence');
const TimelineIntelligence = require('../timelines/TimelineIntelligence');
const EventIntelligence = require('../events/EventIntelligence');
const SmartCollectionManager = require('../collections/SmartCollectionManager');
const MemorySimilarityEngine = require('../similarity/MemorySimilarityEngine');
const MemoryConfidenceEngine = require('../confidence/MemoryConfidenceEngine');
const MemoryReasoningEngine = require('../reasoning/MemoryReasoningEngine');
const MemoryRankingEngine = require('../ranking/MemoryRankingEngine');
const MemorySearchValidator = require('../validation/MemorySearchValidator');
const SearchSessionManager = require('../search/SearchSessionManager');
const MemorySearchEngine = require('../search/MemorySearchEngine');

class VisualMemoryIntelligenceEngine {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof MemoryIntelligenceConfiguration
      ? options.configuration
      : new MemoryIntelligenceConfiguration(options.configuration || options);
    this.logger = options.logger || null;
    this.events = options.events || new MemoryIntelligenceEventBus();
    this.diagnostics = options.diagnostics || new MemoryIntelligenceDiagnostics({ logger: this.logger });
    this.lifecycle = new MemoryIntelligenceLifecycle({ events: this.events, diagnostics: this.diagnostics });
    this.relationships = options.relationships || new RelationshipIntelligence();
    this.timeline = options.timeline || new TimelineIntelligence();
    this.eventsReasoner = options.eventsReasoner || new EventIntelligence();
    this.collections = options.collections || new SmartCollectionManager();
    this.similarity = options.similarity || new MemorySimilarityEngine();
    this.confidence = options.confidence || new MemoryConfidenceEngine();
    this.reasoning = options.reasoning || new MemoryReasoningEngine({
      relationshipIntelligence: this.relationships,
      timelineIntelligence: this.timeline,
      eventIntelligence: this.eventsReasoner,
      collectionManager: this.collections
    });
    this.ranking = options.ranking || new MemoryRankingEngine({
      configuration: this.configuration,
      confidenceEngine: this.confidence,
      similarityEngine: this.similarity
    });
    this.validator = options.validator || new MemorySearchValidator();
    this.sessions = options.sessions || new SearchSessionManager({ limit: this.configuration.search.cacheSize });
    this.searchEngine = options.searchEngine || new MemorySearchEngine({
      reasoningEngine: this.reasoning,
      rankingEngine: this.ranking,
      validator: this.validator,
      sessionManager: this.sessions,
      diagnostics: this.diagnostics
    });
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return this;
    this.lifecycle.transition('initializing');
    this.initialized = true;
    this.lifecycle.transition('ready');
    this.events.emit(MEMORY_INTELLIGENCE_EVENTS.INITIALIZED, this.getStatus());
    this.diagnostics.record('initialized', this.getStatus());
    return this;
  }

  async search(input = {}) {
    await this.initialize();
    this.lifecycle.transition('searching');
    this.events.emit(MEMORY_INTELLIGENCE_EVENTS.SEARCH_STARTED, { visualIntent: input.visualQuery?.intent || null });
    const result = await this.searchEngine.search(input);
    this.lifecycle.transition('ready');
    this.events.emit(result.success ? MEMORY_INTELLIGENCE_EVENTS.SEARCH_COMPLETED : MEMORY_INTELLIGENCE_EVENTS.SEARCH_FAILED, {
      total: result.total,
      error: result.error || null
    });
    return result;
  }

  continueSearch(continuationToken) {
    return this.sessions.continue(continuationToken);
  }

  cancelSearch(sessionId, reason = 'cancelled') {
    return this.sessions.cancel(sessionId, reason);
  }

  pause() {
    this.lifecycle.transition('paused');
    return this.getStatus();
  }

  resume() {
    this.lifecycle.transition('ready');
    return this.getStatus();
  }

  async shutdown() {
    this.initialized = false;
    this.lifecycle.transition('shutdown');
    this.events.emit(MEMORY_INTELLIGENCE_EVENTS.SHUTDOWN, this.getStatus());
    return this.getStatus();
  }

  healthCheck() {
    return {
      initialized: this.initialized,
      lifecycle: this.lifecycle.getState(),
      diagnostics: this.diagnostics.summary(),
      sessions: this.sessions.recent(5),
      configuration: this.configuration.toJSON()
    };
  }

  getStatus() {
    return {
      initialized: this.initialized,
      lifecycle: this.lifecycle.getState(),
      configuration: this.configuration.toJSON()
    };
  }
}

module.exports = VisualMemoryIntelligenceEngine;
