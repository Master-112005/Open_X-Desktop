'use strict';

const LearningGuard = require('./LearningGuard');
const { createDefaultLearningConstitution } = require('./LearningConstitution');

const CATEGORY_FILES = Object.freeze({
  preference: 'preferences',
  alias: 'aliases',
  correction: 'corrections',
  habit: 'habits',
  pattern: 'patterns',
  statistic: 'statistics',
  workflow: 'workflows',
  feedback: 'feedback',
  conversation: 'conversation'
});

class LearningPolicy {
  constructor(options = {}) {
    this.allowedCategories = new Set(options.allowedCategories || Object.keys(CATEGORY_FILES));
    this.minConfidence = Number.isFinite(options.minConfidence) ? Number(options.minConfidence) : 0.7;
    this.constitution = options.constitution || createDefaultLearningConstitution(options.constitutionOptions || {});
  }

  check(event = {}) {
    const category = String(event.category || '').trim().toLowerCase();
    if (!this.allowedCategories.has(category)) {
      return { allowed: false, reason: 'Learning category is not approved.' };
    }
    const guard = LearningGuard.isAllowedLearning(category, event.key, String(event.value ?? ''));
    if (!guard.allowed) return { allowed: false, reason: guard.reason };
    if (Number(event.confidence ?? 1) < this.minConfidence) {
      return { allowed: false, reason: 'Learning confidence is below threshold.' };
    }
    const constitutional = this.constitution.evaluateEvent({
      ...event,
      category,
      confidence: Number(event.confidence ?? 1)
    });
    if (!constitutional.allowed) {
      return {
        allowed: false,
        reason: constitutional.reason,
        principle: constitutional.principle,
        score: constitutional.score
      };
    }
    return {
      allowed: true,
      storageCategory: CATEGORY_FILES[category],
      principle: constitutional.principle,
      score: constitutional.score,
      shouldAskFeedback: constitutional.shouldAskFeedback
    };
  }

  isCategoryAllowed(category) {
    return this.allowedCategories.has(String(category || '').trim().toLowerCase());
  }

  storageCategory(category) {
    return CATEGORY_FILES[String(category || '').trim().toLowerCase()] || '';
  }
}

module.exports = LearningPolicy;
