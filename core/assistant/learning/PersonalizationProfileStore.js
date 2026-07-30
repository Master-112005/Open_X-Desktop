'use strict';

const path = require('path');
const {
  ensureDataRoot,
  readSecureJsonFile: readJsonFile,
  writeSecureJsonAtomic: writeJsonAtomic
} = require('../Data');
const LearningGuard = require('./LearningGuard');
const {
  createDefaultLearningConstitution,
  DEFAULT_PRINCIPLES,
  normalizeSubject
} = require('./LearningConstitution');

const PROFILE_VERSION = 1;
const PROFILE_CATEGORIES = Object.freeze([
  'preference',
  'alias',
  'correction',
  'habit',
  'pattern',
  'workflow',
  'feedback',
  'conversation'
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso(fallback = null) {
  return fallback || new Date().toISOString();
}

function parseTime(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value, fallback = 0, min = 0, max = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function categoryBucket(category) {
  const normalized = String(category || '').trim().toLowerCase();
  return PROFILE_CATEGORIES.includes(normalized) ? normalized : 'feedback';
}

function defaultProfile(clock = null) {
  const createdAt = nowIso(clock?.());
  return {
    version: PROFILE_VERSION,
    principles: DEFAULT_PRINCIPLES,
    profile: Object.fromEntries(PROFILE_CATEGORIES.map(category => [category, {}])),
    prompts: [],
    rejected: [],
    audit: [],
    metadata: {
      createdAt,
      updatedAt: null,
      totalAccepted: 0,
      totalRejected: 0,
      totalPrompts: 0
    }
  };
}

class PersonalizationProfileStore {
  constructor(options = {}) {
    this.config = options.config || {};
    this.maxRecords = Math.max(25, Math.min(5000, Number(options.maxRecords) || 800));
    this.maxAudit = Math.max(10, Math.min(1000, Number(options.maxAudit) || 200));
    this.maxPrompts = Math.max(10, Math.min(500, Number(options.maxPrompts) || 100));
    this.halfLifeDays = Math.max(1, Math.min(365, Number(options.halfLifeDays) || 90));
    this.clock = typeof options.clock === 'function' ? options.clock : () => new Date().toISOString();
    const baseDir = options.baseDir
      ? path.resolve(options.baseDir)
      : path.join(ensureDataRoot(this.config).learningDir, 'v3');
    this.filePath = path.resolve(options.filePath || path.join(baseDir, 'personalization_profile.json'));
    this.keyPath = options.keyPath || path.join(baseDir, '.security', 'openx-data.key');
    this.constitution = options.constitution || createDefaultLearningConstitution(options.constitutionOptions || {});
    this.data = this._read();
  }

  applyEvents(events = [], options = {}) {
    const accepted = [];
    const rejected = [];
    const prompts = [];
    const timestamp = nowIso(options.now || this.clock());

    for (const event of events) {
      const category = categoryBucket(event.category);
      const key = String(event.key || '').trim();
      const subject = normalizeSubject(category, key);
      const bucket = this.data.profile[category] || {};
      const existing = bucket[subject] || null;
      const decision = this.constitution.evaluateEvent(event, {
        existingCount: Number(existing?.evidenceCount || 0),
        feedbackPrompts: options.feedbackPrompts
      });

      if (!decision.allowed) {
        const rejectedItem = this._rejected(event, decision, timestamp);
        rejected.push(rejectedItem);
        this._pushBounded(this.data.rejected, rejectedItem, this.maxAudit);
        this.data.metadata.totalRejected += 1;
        continue;
      }

      const record = this._mergeRecord(existing, event, decision, timestamp);
      bucket[subject] = record;
      this.data.profile[category] = bucket;
      accepted.push({
        category,
        key,
        value: record.value,
        confidence: record.confidence,
        score: record.score,
        reason: decision.reason
      });

      if (decision.shouldAskFeedback) {
        const prompt = this._promptFor(event, decision, timestamp);
        prompts.push(prompt);
        this._pushBounded(this.data.prompts, prompt, this.maxPrompts);
        this.data.metadata.totalPrompts += 1;
      }

      this._pushBounded(this.data.audit, {
        at: timestamp,
        category,
        key,
        decision: 'accepted',
        score: record.score,
        confidence: record.confidence,
        source: record.source,
        principle: decision.principle,
        reason: decision.reason
      }, this.maxAudit);
      this.data.metadata.totalAccepted += 1;
    }

    if (accepted.length || rejected.length || prompts.length) {
      this.data.metadata.updatedAt = timestamp;
      this._prune(timestamp);
      this._write();
    }

    return {
      accepted,
      rejected,
      prompts,
      summary: this.summarize()
    };
  }

  recordRejected(rejections = [], options = {}) {
    const timestamp = nowIso(options.now || this.clock());
    let count = 0;
    for (const item of rejections) {
      const reason = String(item.reason || 'Rejected');
      const rejectedItem = LearningGuard.sanitizeForLearning({
        at: timestamp,
        category: item.category || 'unknown',
        key: item.key || '',
        reason,
        principle: /secret|sensitive|password|token|credential|key/i.test(reason) ? 'no-secrets' : 'user-control',
        score: 0
      });
      this._pushBounded(this.data.rejected, rejectedItem, this.maxAudit);
      this._pushBounded(this.data.audit, {
        at: timestamp,
        category: rejectedItem.category,
        key: rejectedItem.key,
        decision: 'rejected',
        score: 0,
        principle: rejectedItem.principle,
        reason: rejectedItem.reason
      }, this.maxAudit);
      this.data.metadata.totalRejected += 1;
      count += 1;
    }
    if (count > 0) {
      this.data.metadata.updatedAt = timestamp;
      this._write();
    }
    return { rejected: count, summary: this.summarize() };
  }

  snapshot() {
    return clone(this.data);
  }

  summarize() {
    const counts = {};
    for (const category of PROFILE_CATEGORIES) {
      counts[category] = Object.keys(this.data.profile?.[category] || {}).length;
    }
    return {
      path: this.filePath,
      counts,
      prompts: this.data.prompts.length,
      rejected: this.data.rejected.length,
      totalAccepted: this.data.metadata.totalAccepted,
      totalRejected: this.data.metadata.totalRejected,
      updatedAt: this.data.metadata.updatedAt,
      principles: this.constitution.explain().map(item => item.id)
    };
  }

  forget(category, key) {
    const bucket = this.data.profile?.[categoryBucket(category)];
    if (!bucket) return false;
    const subject = normalizeSubject(category, key);
    if (!bucket[subject]) return false;
    delete bucket[subject];
    this.data.metadata.updatedAt = nowIso(this.clock());
    this._write();
    return true;
  }

  clear() {
    this.data = defaultProfile(this.clock);
    this._write();
    return true;
  }

  _mergeRecord(existing, event, decision, timestamp) {
    const lastConfidence = this._decayedConfidence(existing, timestamp);
    const incomingConfidence = clamp(event.confidence, decision.score);
    const score = clamp(decision.score);
    const combinedConfidence = existing
      ? clamp(1 - ((1 - lastConfidence) * (1 - Math.max(score, incomingConfidence))))
      : Math.max(score, incomingConfidence);
    const evidenceCount = Math.min(1000, Number(existing?.evidenceCount || 0) + 1);

    return LearningGuard.sanitizeForLearning({
      category: categoryBucket(event.category),
      key: String(event.key || '').trim(),
      value: event.value,
      confidence: Number(combinedConfidence.toFixed(4)),
      score: Number(score.toFixed(4)),
      source: event.source || 'learning-engine',
      module: event.module || 'unknown',
      evidenceCount,
      firstSeen: existing?.firstSeen || timestamp,
      lastSeen: timestamp,
      principle: decision.principle,
      reason: decision.reason,
      metadata: event.metadata || {}
    });
  }

  _decayedConfidence(existing, timestamp) {
    if (!existing) return 0;
    const ageMs = Math.max(0, parseTime(timestamp) - parseTime(existing.lastSeen || existing.firstSeen));
    const halfLifeMs = this.halfLifeDays * 24 * 60 * 60 * 1000;
    const decay = Math.pow(0.5, ageMs / halfLifeMs);
    return clamp(Number(existing.confidence || 0) * decay);
  }

  _promptFor(event, decision, timestamp) {
    return LearningGuard.sanitizeForLearning({
      at: timestamp,
      category: categoryBucket(event.category),
      key: event.key,
      value: event.value,
      score: Number(decision.score.toFixed(4)),
      reason: 'Ask user before making this a stronger habit.',
      principle: 'ask-selectively'
    });
  }

  _rejected(event, decision, timestamp) {
    return LearningGuard.sanitizeForLearning({
      at: timestamp,
      category: event.category || 'unknown',
      key: event.key || '',
      reason: decision.reason,
      principle: decision.principle,
      score: Number(decision.score || 0)
    });
  }

  _pushBounded(list, item, limit) {
    list.push(item);
    if (list.length > limit) list.splice(0, list.length - limit);
  }

  _prune(timestamp) {
    for (const category of PROFILE_CATEGORIES) {
      const entries = Object.entries(this.data.profile[category] || {});
      if (entries.length <= this.maxRecords) continue;
      const keep = new Set(entries
        .sort((left, right) => {
          const scoreDiff = Number(right[1].confidence || 0) - Number(left[1].confidence || 0);
          if (Math.abs(scoreDiff) > 0.001) return scoreDiff;
          return parseTime(right[1].lastSeen || timestamp) - parseTime(left[1].lastSeen || timestamp);
        })
        .slice(0, this.maxRecords)
        .map(([key]) => key));
      for (const key of Object.keys(this.data.profile[category])) {
        if (!keep.has(key)) delete this.data.profile[category][key];
      }
    }
  }

  _read() {
    return readJsonFile(this.filePath, () => defaultProfile(this.clock), {
      createIfMissing: true,
      config: this.config,
      keyPath: this.keyPath,
      validate: value => {
        if (!value || value.version !== PROFILE_VERSION || !value.profile || !value.metadata) return false;
        return PROFILE_CATEGORIES.every(category => value.profile[category] && typeof value.profile[category] === 'object');
      }
    });
  }

  _write() {
    writeJsonAtomic(this.filePath, this.data, { backup: true, config: this.config, keyPath: this.keyPath });
  }
}

module.exports = PersonalizationProfileStore;
module.exports.PROFILE_CATEGORIES = PROFILE_CATEGORIES;
