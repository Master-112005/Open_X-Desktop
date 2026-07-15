'use strict';

const VisualMemoryLearningConfiguration = require('../configuration/VisualMemoryLearningConfiguration');
const VisualMemoryLearningDiagnostics = require('../diagnostics/VisualMemoryLearningDiagnostics');
const { VisualMemoryLearningEventBus, VISUAL_MEMORY_LEARNING_EVENTS } = require('../events/VisualMemoryLearningEvents');
const VisualMemoryLearningLifecycle = require('../lifecycle/VisualMemoryLearningLifecycle');
const VisualMemoryLearningValidator = require('../validation/VisualMemoryLearningValidator');
const VisualMemoryFeedbackEngine = require('../feedback/VisualMemoryFeedbackEngine');
const VisualMemoryCorrectionEngine = require('../corrections/VisualMemoryCorrectionEngine');
const VisualMemoryPreferenceEngine = require('../preferences/VisualMemoryPreferenceEngine');
const VisualMemoryRankingLearning = require('../ranking/VisualMemoryRankingLearning');
const VisualMemoryRecommendationEngine = require('../recommendations/VisualMemoryRecommendationEngine');
const VisualMemoryLearningDashboard = require('../dashboard/VisualMemoryLearningDashboard');
const { boundedPush, id, normalizeKey, nowIso } = require('../utils/learning-utils');

function createLearningState() {
  return {
    feedback: [],
    corrections: [],
    preferences: {},
    ranking: {},
    relationships: [],
    events: [],
    collections: [],
    timelines: [],
    searchPatterns: [],
    recommendations: [],
    history: [],
    audit: []
  };
}

class VisualMemoryLearningEngine {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof VisualMemoryLearningConfiguration
      ? options.configuration
      : new VisualMemoryLearningConfiguration(options.configuration || options);
    this.state = { ...createLearningState(), ...(options.state || {}) };
    this.assistantLearning = options.assistantLearning || options.learningManager || null;
    this.events = options.events || new VisualMemoryLearningEventBus();
    this.diagnostics = options.diagnostics || new VisualMemoryLearningDiagnostics({ logger: options.logger || null });
    this.lifecycle = new VisualMemoryLearningLifecycle({ events: this.events, diagnostics: this.diagnostics });
    this.validator = options.validator || new VisualMemoryLearningValidator();
    this.feedback = new VisualMemoryFeedbackEngine({ state: this.state, configuration: this.configuration, validator: this.validator, events: this.events });
    this.corrections = new VisualMemoryCorrectionEngine({ state: this.state, configuration: this.configuration, validator: this.validator, events: this.events });
    this.preferences = new VisualMemoryPreferenceEngine({ state: this.state, configuration: this.configuration, validator: this.validator, events: this.events });
    this.ranking = new VisualMemoryRankingLearning({ state: this.state, configuration: this.configuration, events: this.events });
    this.recommendations = new VisualMemoryRecommendationEngine({ state: this.state, configuration: this.configuration, events: this.events });
    this.dashboard = new VisualMemoryLearningDashboard({ state: this.state, diagnostics: this.diagnostics, configuration: this.configuration });
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return this;
    this.initialized = true;
    this.lifecycle.transition('ready');
    this.events.emit(VISUAL_MEMORY_LEARNING_EVENTS.INITIALIZED, this.getStatus());
    return this;
  }

  async learn(input = {}) {
    await this.initialize();
    if (!this.configuration.enabled) return { learned: false, disabled: true, events: [] };
    this.lifecycle.transition('learning', { type: input.type || 'generic' });
    const events = [];
    const records = [];
    if (input.feedback) {
      const record = this.recordFeedback(input.feedback);
      records.push(record);
      events.push(...this.feedback.toLearningEvents(record));
      const ranking = this.ranking.applyFeedback(record);
      if (ranking) records.push(ranking);
    }
    if (input.correction) {
      const record = this.recordCorrection(input.correction);
      records.push(record);
      events.push(...this.corrections.toLearningEvents(record));
      this._applyConfidenceCorrection(record);
    }
    if (input.preference) {
      const record = this.setPreference(input.preference);
      records.push(record);
      events.push(...this.preferences.toLearningEvents(record));
    }
    if (input.relationship) records.push(this.recordRelationship(input.relationship));
    if (input.event) records.push(this.recordEvent(input.event));
    if (input.collection) records.push(this.recordCollection(input.collection));
    if (input.timeline) records.push(this.recordTimeline(input.timeline));
    if (input.searchPattern) records.push(this.recordSearchPattern(input.searchPattern));
    const committed = await this._commitToAssistantLearning(events, input);
    const generated = this.recommendations.generate(input.context || {});
    const audit = boundedPush(this.state.audit, {
      id: id('vmaudit'),
      action: 'learn',
      inputType: input.type || 'generic',
      eventCount: events.length,
      recordCount: records.length,
      recommendationCount: generated.length,
      createdAt: nowIso()
    }, this.configuration.retention.maxEvents);
    this.lifecycle.transition('ready');
    this.events.emit(VISUAL_MEMORY_LEARNING_EVENTS.LEARNED, { eventCount: events.length, recordCount: records.length });
    return { learned: records.length > 0 || events.length > 0, records, learningEvents: events, committed, recommendations: generated, audit };
  }

  recordFeedback(input) {
    const record = this.feedback.record(input);
    boundedPush(this.state.history, { action: 'feedback', recordId: record.id, createdAt: nowIso() }, this.configuration.retention.maxEvents);
    return record;
  }

  recordCorrection(input) {
    const record = this.corrections.record(input);
    boundedPush(this.state.history, { action: 'correction', recordId: record.id, createdAt: nowIso() }, this.configuration.retention.maxEvents);
    return record;
  }

  setPreference(input) {
    return this.preferences.set(input);
  }

  recordRelationship(input = {}) {
    const record = { id: id('vmrel'), ...input, duplicateStorage: false, source: input.source || 'assistant-relationship-system', createdAt: nowIso() };
    boundedPush(this.state.relationships, record, this.configuration.retention.maxEvents);
    return record;
  }

  recordEvent(input = {}) {
    const record = { id: id('vmevent'), ...input, createdAt: nowIso() };
    boundedPush(this.state.events, record, this.configuration.retention.maxEvents);
    return record;
  }

  recordCollection(input = {}) {
    const record = { id: id('vmcollection'), ...input, key: normalizeKey(input.name || input.collection || input.key), createdAt: nowIso() };
    boundedPush(this.state.collections, record, this.configuration.retention.maxEvents);
    return record;
  }

  recordTimeline(input = {}) {
    const record = { id: id('vmtime'), ...input, createdAt: nowIso() };
    boundedPush(this.state.timelines, record, this.configuration.retention.maxEvents);
    return record;
  }

  recordSearchPattern(input = {}) {
    const record = { id: id('vmsearchpattern'), ...input, key: normalizeKey(input.query || input.key), createdAt: nowIso() };
    boundedPush(this.state.searchPatterns, record, this.configuration.retention.maxEvents);
    return record;
  }

  adaptRanking(results = []) {
    return this.ranking.adaptResults(results);
  }

  getRecommendations(context = {}) {
    const generated = this.recommendations.generate(context);
    return generated.length ? generated : this.recommendations.suggestions();
  }

  undo(recordId) {
    const correction = this.state.corrections.find(item => item.id === recordId);
    if (correction) correction.undone = true;
    const preference = Object.values(this.state.preferences).find(item => item.id === recordId);
    if (preference) delete this.state.preferences[preference.key];
    const feedbackIndex = this.state.feedback.findIndex(item => item.id === recordId);
    if (feedbackIndex >= 0) this.state.feedback.splice(feedbackIndex, 1);
    const undone = Boolean(correction || preference || feedbackIndex >= 0);
    if (undone) boundedPush(this.state.audit, { id: id('vmaudit'), action: 'undo', recordId, createdAt: nowIso() }, this.configuration.retention.maxEvents);
    this.events.emit(VISUAL_MEMORY_LEARNING_EVENTS.UNDONE, { recordId, undone });
    return { recordId, undone };
  }

  reset() {
    this.state.feedback = [];
    this.state.corrections = [];
    this.state.preferences = {};
    this.state.ranking = {};
    this.state.relationships = [];
    this.state.events = [];
    this.state.collections = [];
    this.state.timelines = [];
    this.state.searchPatterns = [];
    this.state.recommendations = [];
    this.state.history = [];
    boundedPush(this.state.audit, { id: id('vmaudit'), action: 'reset', createdAt: nowIso() }, this.configuration.retention.maxEvents);
    this.events.emit(VISUAL_MEMORY_LEARNING_EVENTS.RESET, { reset: true });
    return { reset: true };
  }

  exportData() {
    return JSON.parse(JSON.stringify({ state: this.state, configuration: this.configuration.toJSON() }));
  }

  getDashboard() {
    return this.dashboard.snapshot();
  }

  healthCheck() {
    return {
      initialized: this.initialized,
      lifecycle: this.lifecycle.getState(),
      enabled: this.configuration.enabled,
      diagnostics: this.diagnostics.summary(),
      counts: {
        feedback: this.state.feedback.length,
        corrections: this.state.corrections.length,
        preferences: Object.keys(this.state.preferences).length,
        ranking: Object.keys(this.state.ranking).length,
        recommendations: this.state.recommendations.length
      },
      modelRetraining: false,
      localOnly: true
    };
  }

  getStatus() {
    return {
      initialized: this.initialized,
      lifecycle: this.lifecycle.getState(),
      enabled: this.configuration.enabled,
      configuration: this.configuration.toJSON(),
      localOnly: true
    };
  }

  async shutdown() {
    this.initialized = false;
    this.lifecycle.transition('shutdown');
    this.events.emit(VISUAL_MEMORY_LEARNING_EVENTS.SHUTDOWN, this.getStatus());
    return this.getStatus();
  }

  async _commitToAssistantLearning(events, input) {
    if (!events.length || !this.assistantLearning?.learn) return { committed: false, reason: 'assistant-learning-not-connected', events: events.length };
    return this.assistantLearning.learn({
      success: true,
      intent: 'visual-memory.learning',
      entities: {},
      data: { visualMemoryLearningEvents: events },
      response: ''
    }, {
      metadata: {
        rawInput: input.rawInput || '',
        visualMemoryLearningEvents: events,
        source: 'visual-memory-learning'
      }
    });
  }

  _applyConfidenceCorrection(correction) {
    const key = normalizeKey(correction.memoryId || correction.photoId || correction.identityId);
    const current = this.state.ranking[key] || { key, score: 0, positive: 0, negative: 0, updatedAt: null };
    current.score = Math.max(-this.configuration.ranking.maxAdjustment, current.score + this.configuration.ranking.negativeWeight);
    current.negative += 1;
    current.updatedAt = nowIso();
    this.state.ranking[key] = current;
  }
}

VisualMemoryLearningEngine.createLearningState = createLearningState;

module.exports = VisualMemoryLearningEngine;
