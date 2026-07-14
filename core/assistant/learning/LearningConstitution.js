'use strict';

const LearningGuard = require('./LearningGuard');

const DEFAULT_PRINCIPLES = Object.freeze([
  {
    id: 'local-first',
    title: 'Keep personal learning local by default',
    summary: 'Store user-specific learning on this device unless the user explicitly exports or syncs it.'
  },
  {
    id: 'user-control',
    title: 'Make learning inspectable and forgettable',
    summary: 'Every durable memory needs a category, reason, confidence, and deletion path.'
  },
  {
    id: 'no-secrets',
    title: 'Never learn secrets or private identifiers',
    summary: 'Passwords, keys, tokens, OTPs, payment data, private addresses, and similar data are rejected.'
  },
  {
    id: 'evidence-weighted',
    title: 'Prefer corrections and repeated evidence over one-off guesses',
    summary: 'Explicit user corrections count more than inferred behavior; repeated success raises confidence.'
  },
  {
    id: 'ask-selectively',
    title: 'Ask only when learning is useful and uncertain',
    summary: 'Prompt for feedback on novel, high-impact, or low-confidence behavior instead of every turn.'
  },
  {
    id: 'no-permission-bypass',
    title: 'Learning cannot bypass safety or permissions',
    summary: 'A learned workflow or preference never overrides confirmation, security, or validation rules.'
  }
]);

const CATEGORY_WEIGHTS = Object.freeze({
  correction: 0.95,
  preference: 0.9,
  alias: 0.82,
  workflow: 0.78,
  habit: 0.72,
  pattern: 0.68,
  statistic: 0.48,
  feedback: 0.84,
  conversation: 0.45
});

const SOURCE_WEIGHTS = Object.freeze({
  'explicit-user-correction': 1,
  'explicit-user-preference': 1,
  'explicit-user-feedback': 0.95,
  'repeated-successful-use': 0.82,
  'long-term-usage': 0.76,
  'command-sequence': 0.72,
  'response-metadata': 0.52,
  'usage-statistics': 0.48,
  'learning-engine': 0.5
});

const HIGH_IMPACT_CATEGORIES = new Set(['correction', 'preference', 'workflow', 'alias']);
const LOW_VALUE_CATEGORIES = new Set(['statistic', 'conversation']);

function clamp(value, fallback = 0, min = 0, max = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeCategory(category) {
  return String(category || '').trim().toLowerCase();
}

function normalizeSubject(category, key) {
  return `${normalizeCategory(category)}:${String(key || '').trim().toLowerCase()}`.slice(0, 180);
}

function weightForSource(source) {
  const normalized = String(source || '').trim().toLowerCase();
  return SOURCE_WEIGHTS[normalized] ?? 0.55;
}

class LearningConstitution {
  constructor(options = {}) {
    this.minScore = clamp(options.minScore, 0.58, 0, 1);
    this.feedbackPromptScore = clamp(options.feedbackPromptScore, 0.74, 0, 1);
    this.lowConfidenceBand = clamp(options.lowConfidenceBand, 0.16, 0, 0.5);
    this.principles = options.principles || DEFAULT_PRINCIPLES;
  }

  evaluateEvent(event = {}, options = {}) {
    const category = normalizeCategory(event.category);
    const key = String(event.key || '').trim();
    const value = String(event.value ?? '').trim();
    const confidence = clamp(event.confidence, 1);
    const source = String(event.source || 'learning-engine').trim();
    const existingCount = Math.max(0, Number(options.existingCount) || 0);
    const explicit = /^explicit-user-/.test(source);

    if (!category || !key || !value) {
      return this._deny('Learning event is incomplete.', 'user-control');
    }

    const guard = LearningGuard.isAllowedLearning(category, key, value);
    if (!guard.allowed) {
      return this._deny(guard.reason, 'no-secrets');
    }

    const categoryWeight = CATEGORY_WEIGHTS[category] ?? 0.5;
    const sourceWeight = weightForSource(source);
    const evidenceWeight = Math.min(1, (existingCount + (explicit ? 2 : 1)) / 4);
    const highImpactBonus = HIGH_IMPACT_CATEGORIES.has(category) ? 0.06 : 0;
    const lowValuePenalty = LOW_VALUE_CATEGORIES.has(category) ? 0.08 : 0;
    const score = clamp(
      confidence * 0.42 +
      sourceWeight * 0.24 +
      categoryWeight * 0.2 +
      evidenceWeight * 0.14 +
      highImpactBonus -
      lowValuePenalty
    );

    if (score < this.minScore) {
      return {
        allowed: false,
        reason: 'Learning evidence is not strong enough yet.',
        principle: 'evidence-weighted',
        score,
        shouldAskFeedback: this.shouldAskFeedback({ ...event, score, category, source }, options)
      };
    }

    return {
      allowed: true,
      reason: explicit ? 'Explicit user signal accepted.' : 'Repeated behavior accepted with bounded confidence.',
      principle: explicit ? 'user-control' : 'evidence-weighted',
      score,
      shouldAskFeedback: this.shouldAskFeedback({ ...event, score, category, source }, options)
    };
  }

  shouldAskFeedback(event = {}, options = {}) {
    const category = normalizeCategory(event.category);
    if (options.feedbackPrompts === false) return false;
    if (LOW_VALUE_CATEGORIES.has(category)) return false;
    const source = String(event.source || '').toLowerCase();
    if (/^explicit-user-/.test(source)) return false;
    const score = clamp(event.score, clamp(event.confidence, 0.5));
    const isUncertain = score >= this.minScore - this.lowConfidenceBand && score < this.feedbackPromptScore;
    const isHighImpact = HIGH_IMPACT_CATEGORIES.has(category);
    const isNovel = Number(options.existingCount || 0) === 0;
    return Boolean(isUncertain || (isHighImpact && isNovel));
  }

  _deny(reason, principle) {
    return {
      allowed: false,
      reason,
      principle,
      score: 0,
      shouldAskFeedback: false
    };
  }

  explain() {
    return this.principles.map(item => ({ ...item }));
  }
}

function createDefaultLearningConstitution(options = {}) {
  return new LearningConstitution(options);
}

module.exports = {
  LearningConstitution,
  createDefaultLearningConstitution,
  DEFAULT_PRINCIPLES,
  normalizeSubject
};
