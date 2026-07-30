'use strict';

const MAX_DIAGNOSTIC_ITEMS = 100;

function pushBounded(list, item, limit = MAX_DIAGNOSTIC_ITEMS) {
  list.push(item);
  if (list.length > limit) list.splice(0, list.length - limit);
}

function sanitizeData(value) {
  if (!value || typeof value !== 'object') return value;
  try {
    return JSON.parse(JSON.stringify(value, (key, item) =>
      /(password|token|secret|credential|otp|cookie|authorization)/i.test(key) ? '[redacted]' : item
    ));
  } catch (_) {
    return { note: 'diagnostic data was not serializable' };
  }
}

class LearningDiagnostics {
  constructor(options = {}) {
    this.limit = Math.max(10, Math.min(1000, Number(options.limit) || MAX_DIAGNOSTIC_ITEMS));
    this.learningTime = {};
    this.storageWrites = 0;
    this.patternsDetected = 0;
    this.correctionsLearned = 0;
    this.preferenceUpdates = 0;
    this.warnings = [];
    this.errors = [];
    this.pipelineOrder = [];
    this.memoryUsage = this._memoryUsage();
  }

  time(id, durationMs) { this.learningTime[String(id || '')] = Math.max(0, Number(durationMs) || 0); }
  write(count = 1) { this.storageWrites += Math.max(0, Number(count) || 0); }
  pattern() { this.patternsDetected += 1; }
  correction() { this.correctionsLearned += 1; }
  preference() { this.preferenceUpdates += 1; }
  order(id) { pushBounded(this.pipelineOrder, String(id || ''), this.limit); }
  warn(message, data = {}) {
    pushBounded(this.warnings, { message: String(message || ''), data: sanitizeData(data), timestamp: Date.now() }, this.limit);
  }
  error(error, data = {}) {
    pushBounded(this.errors, {
      name: error?.name || 'Error',
      message: String(error?.message || error || ''),
      code: error?.code || '',
      stack: error?.stack || '',
      data: sanitizeData(data),
      timestamp: Date.now()
    }, this.limit);
  }

  _memoryUsage() {
    return typeof process !== 'undefined' && typeof process.memoryUsage === 'function'
      ? process.memoryUsage()
      : null;
  }

  toJSON() {
    return {
      learningTime: { ...this.learningTime },
      storageWrites: this.storageWrites,
      patternsDetected: this.patternsDetected,
      correctionsLearned: this.correctionsLearned,
      preferenceUpdates: this.preferenceUpdates,
      warnings: this.warnings.slice(),
      errors: this.errors.slice(),
      pipelineOrder: this.pipelineOrder.slice(),
      summary: {
        modulesRun: this.pipelineOrder.length,
        warningCount: this.warnings.length,
        errorCount: this.errors.length
      },
      memoryUsage: this.memoryUsage
    };
  }
}

function countBy(list, keySelector) {
  return list.reduce((counts, item) => {
    const key = String(keySelector(item) || 'unknown');
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

class LearningAnalytics {
  summarize(context, storageResult = {}) {
    const learned = Array.isArray(storageResult.learned) ? storageResult.learned : [];
    const rejected = Array.isArray(context.itemsRejected) ? context.itemsRejected : [];
    const modules = context.metadata.modules || {};
    const slowModules = Object.entries(modules)
      .filter(([, module]) => Number(module.durationMs || 0) >= Math.max(25, context.configuration?.moduleTimeoutMs || 250))
      .map(([id, module]) => ({ id, durationMs: module.durationMs, skipped: module.skipped === true }))
      .slice(0, 10);
    return {
      learningEvents: context.acceptedEvents.length,
      rejectedEvents: rejected.length,
      storageWrites: storageResult.storageWrites || 0,
      learnedByCategory: countBy(learned, item => item.category),
      rejectedByReason: countBy(rejected, item => item.reason),
      correctionsAccepted: learned.filter(item => item.category === 'corrections').length,
      aliasesAccepted: learned.filter(item => item.category === 'aliases').length,
      habitsAccepted: learned.filter(item => item.category === 'habits').length,
      patternsDetected: learned.filter(item => item.category === 'patterns').length,
      preferenceUpdates: storageResult.updatedPreferences?.length || 0,
      workflowFrequency: storageResult.updatedWorkflows?.length || 0,
      personalization: context.metadata.personalization || null,
      learningPrompts: Array.isArray(context.metadata.learningPrompts) ? context.metadata.learningPrompts.length : 0,
      moduleCount: Object.keys(modules).length,
      slowModules,
      durationMs: Math.max(0, Date.now() - context.timing.startedAt)
    };
  }
}

module.exports = LearningDiagnostics;
module.exports.LearningAnalytics = LearningAnalytics;
