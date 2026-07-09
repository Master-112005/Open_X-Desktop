'use strict';

const LearningDiagnostics = require('./LearningDiagnostics');
const LearningResult = require('./LearningResult');

class LearningContext {
  constructor(options = {}) {
    this.assistantResponse = options.assistantResponse || null;
    this.configuration = options.configuration || null;
    this.policy = options.policy || null;
    this.validator = options.validator || null;
    this.storage = options.storage || null;
    this.metadata = { ...(options.metadata || {}) };
    this.diagnostics = options.diagnostics || new LearningDiagnostics();
    this.acceptedEvents = [];
    this.itemsLearned = [];
    this.itemsRejected = [];
    this.updatedPreferences = [];
    this.updatedAliases = [];
    this.updatedHabits = [];
    this.updatedWorkflows = [];
    this.timing = { startedAt: Date.now(), finishedAt: null, durationMs: 0 };
  }

  now() {
    return this.configuration?.clock?.() || new Date().toISOString();
  }

  addEvent(event = {}) {
    const checked = this.validator.validate(event, this);
    if (!checked.valid) {
      this.itemsRejected.push({
        category: event.category || 'unknown',
        key: event.key || '',
        reason: checked.reason
      });
      return null;
    }
    const normalized = {
      category: checked.event.category,
      key: checked.event.key,
      value: checked.event.value,
      confidence: checked.event.confidence,
      source: checked.event.source || 'learning-engine',
      module: checked.event.module || 'unknown',
      metadata: checked.event.metadata || {},
      learnedAt: this.now()
    };
    this.acceptedEvents.push(normalized);
    return normalized;
  }

  applyStorageResult(result = {}) {
    this.itemsLearned = result.learned || [];
    this.itemsRejected.push(...(result.rejected || []));
    this.updatedPreferences = result.updatedPreferences || [];
    this.updatedAliases = result.updatedAliases || [];
    this.updatedHabits = result.updatedHabits || [];
    this.updatedWorkflows = result.updatedWorkflows || [];
    this.diagnostics.write(result.storageWrites || 0);
    for (const item of this.itemsLearned) {
      if (item.category === 'corrections') this.diagnostics.correction();
      if (item.category === 'preferences') this.diagnostics.preference();
      if (item.category === 'patterns') this.diagnostics.pattern();
    }
  }

  toLearningResult() {
    this.timing.finishedAt = Date.now();
    this.timing.durationMs = Math.max(0, this.timing.finishedAt - this.timing.startedAt);
    return new LearningResult({
      completed: true,
      itemsLearned: this.itemsLearned,
      itemsRejected: this.itemsRejected,
      updatedPreferences: this.updatedPreferences,
      updatedAliases: this.updatedAliases,
      updatedHabits: this.updatedHabits,
      updatedWorkflows: this.updatedWorkflows,
      diagnostics: this.diagnostics.toJSON(),
      metadata: this.metadata,
      timing: this.timing,
      version: this.configuration?.version || '12.0.0'
    });
  }
}

module.exports = LearningContext;
