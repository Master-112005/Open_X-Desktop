'use strict';

const LearningDiagnostics = require('./LearningDiagnostics');
const LearningResult = require('./LearningResult');
const LearningGuard = require('./LearningGuard');

function pushBounded(list, item, limit) {
  list.push(item);
  if (list.length > limit) list.splice(0, list.length - limit);
}

class LearningContext {
  constructor(options = {}) {
    this.assistantResponse = options.assistantResponse || null;
    this.configuration = options.configuration || null;
    this.policy = options.policy || null;
    this.validator = options.validator || null;
    this.storage = options.storage || null;
    this.metadata = LearningGuard.sanitizeForLearning({ ...(options.metadata || {}) });
    this.diagnostics = options.diagnostics || new LearningDiagnostics({ limit: this.configuration?.maxDiagnostics });
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
      this.addRejected({
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
      storageCategory: checked.event.storageCategory,
      metadata: LearningGuard.sanitizeForLearning(checked.event.metadata || {}),
      learnedAt: this.now()
    };
    pushBounded(this.acceptedEvents, normalized, this.configuration?.maxEventsPerRun || 100);
    return normalized;
  }

  predictedCount(category, key, pendingCategory = null) {
    const storageCategory = String(category || '').trim();
    const eventKey = String(key || '').trim();
    if (!storageCategory || !eventKey) return 0;

    const persisted = Number(this.storage?.getCount?.(storageCategory, eventKey) || 0);
    const pending = this.acceptedEvents.filter(event => {
      const eventStorageCategory = event.storageCategory || this.policy?.storageCategory?.(event.category);
      const storedKey = `${event.category}:${event.key}`;
      return eventStorageCategory === storageCategory &&
        storedKey === eventKey &&
        (!pendingCategory || event.category === pendingCategory);
    }).length;
    if (pending > 0) {
      return persisted + pending;
    }

    const currentActionCount = this._currentSuccessfulActionCount(storageCategory, eventKey);
    return persisted + currentActionCount;
  }

  _currentSuccessfulActionCount(storageCategory, eventKey) {
    if (storageCategory !== 'statistics' || !eventKey.startsWith('statistic:command.')) {
      return 0;
    }
    const route = eventKey.replace(/^statistic:command\./, '');
    const actions = this.assistantResponse?.verificationResult?.successfulActions || [];
    return actions.filter(action => {
      const actionRoute = String(action.route || action.action || action.taskId || '')
        .trim()
        .toLowerCase()
        .replace(/["'`]/g, '')
        .replace(/[^\w\s.:-]/g, ' ')
        .replace(/\s+/g, '.')
        .slice(0, 120);
      return actionRoute === route;
    }).length;
  }

  addRejected(item = {}) {
    pushBounded(this.itemsRejected, LearningGuard.sanitizeForLearning({
      category: item.category || 'unknown',
      key: item.key || '',
      reason: item.reason || 'Rejected'
    }), this.configuration?.maxEventsPerRun || 100);
  }

  recordModule(moduleId, result = {}) {
    if (!this.metadata.modules) this.metadata.modules = {};
    this.metadata.modules[String(moduleId || 'unknown')] = {
      success: result.success !== false,
      skipped: result.skipped === true,
      durationMs: Math.max(0, Number(result.durationMs) || 0),
      error: result.error ? String(result.error.message || result.error).slice(0, 240) : null
    };
  }

  applyStorageResult(result = {}) {
    this.itemsLearned = result.learned || [];
    for (const item of result.rejected || []) this.addRejected(item);
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
