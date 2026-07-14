'use strict';

const LearningGuard = require('./LearningGuard');

class LearningValidator {
  constructor(options = {}) {
    this.maxKeyLength = Number.isFinite(options.maxKeyLength) ? Number(options.maxKeyLength) : 120;
    this.maxValueLength = Number.isFinite(options.maxValueLength) ? Number(options.maxValueLength) : 500;
  }

  validate(event = {}, context = {}) {
    const category = this._clean(event.category, 40).toLowerCase();
    const key = this._clean(event.key, this.maxKeyLength);
    const value = LearningGuard.sanitizeForLearning(this._clean(event.value, this.maxValueLength));
    if (!category || !key || !value) return { valid: false, reason: 'Learning event is incomplete.' };
    if (LearningGuard.isUnsafeObjectKey(key)) return { valid: false, reason: 'Learning key is unsafe.' };
    const policy = context.policy.check({ ...event, category, key, value });
    if (!policy.allowed) return { valid: false, reason: policy.reason };
    return {
      valid: true,
      event: {
        ...event,
        category,
        storageCategory: policy.storageCategory,
        key,
        value,
        confidence: Math.max(0, Math.min(1, Number(event.confidence ?? 1))),
        metadata: LearningGuard.sanitizeForLearning({
          ...(event.metadata || {}),
          learningDecision: {
            principle: policy.principle || null,
            score: Number.isFinite(policy.score) ? Number(policy.score.toFixed(4)) : null,
            shouldAskFeedback: policy.shouldAskFeedback === true
          }
        })
      }
    };
  }

  _clean(value, limit) {
    return String(value ?? '')
      .trim()
      .replace(/[\x00-\x1f\x7f]/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, limit);
  }
}

module.exports = LearningValidator;
