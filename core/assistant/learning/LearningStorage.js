'use strict';

const crypto = require('crypto');
const path = require('path');
const { ensureDataRoot, readJsonFile, writeJsonAtomic } = require('../Data');
const { LearningStorageError } = require('./LearningErrors');
const LearningGuard = require('./LearningGuard');

const CATEGORIES = Object.freeze([
  'preferences',
  'aliases',
  'corrections',
  'habits',
  'patterns',
  'statistics',
  'workflows',
  'feedback',
  'conversation'
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class LearningStorage {
  constructor(options = {}) {
    this.config = options.config || {};
    this.baseDir = path.resolve(options.baseDir || path.join(ensureDataRoot(this.config).learningDir, 'v3'));
    this.maxRecords = Number.isFinite(options.maxRecords) ? Number(options.maxRecords) : 500;
    this.files = Object.fromEntries(CATEGORIES.map(category => [category, path.join(this.baseDir, `${category}.json`)]));
  }

  getCount(category, key) {
    const data = this._read(category);
    return Number(data.records?.[key]?.count || 0);
  }

  commit(events = []) {
    const result = {
      learned: [],
      rejected: [],
      updatedPreferences: [],
      updatedAliases: [],
      updatedHabits: [],
      updatedWorkflows: [],
      storageWrites: 0
    };
    const grouped = new Map();
    for (const event of events.slice(0, Math.max(1, this.maxRecords))) {
      const category = event.storageCategory || this._storageCategory(event.category);
      if (!CATEGORIES.includes(category)) {
        result.rejected.push({ category: event.category, key: event.key, reason: 'Unsupported storage category.' });
        continue;
      }
      if (!grouped.has(category)) grouped.set(category, []);
      grouped.get(category).push(event);
    }

    for (const [category, categoryEvents] of grouped.entries()) {
      const data = this._read(category);
      for (const event of categoryEvents) {
        const key = this._key(event);
        const existing = data.records[key] || {};
        const record = {
          category: event.category,
          key: event.key,
          value: LearningGuard.sanitizeForLearning(event.value),
          confidence: event.confidence,
          source: event.source,
          module: event.module,
          metadata: LearningGuard.sanitizeForLearning(event.metadata || {}),
          count: Number(existing.count || 0) + 1,
          createdAt: existing.createdAt || event.learnedAt,
          updatedAt: event.learnedAt
        };
        data.records[key] = record;
        data.metadata.updatedAt = event.learnedAt;
        data.metadata.totalEvents = Number(data.metadata.totalEvents || 0) + 1;
        result.learned.push({ category, key: event.key, value: event.value, module: event.module });
        if (category === 'preferences') result.updatedPreferences.push({ key: event.key, value: event.value });
        if (category === 'aliases') result.updatedAliases.push({ key: event.key, value: event.value });
        if (category === 'habits') result.updatedHabits.push({ key: event.key, value: event.value });
        if (category === 'workflows') result.updatedWorkflows.push({ key: event.key, value: event.value });
      }
      this._prune(data);
      this._write(category, data);
      result.storageWrites += 1;
    }
    return result;
  }

  snapshot(category) {
    return clone(this._read(category));
  }

  getRecord(category, key) {
    const data = this._read(category);
    return clone(data.records?.[key] || null);
  }

  summarize(category) {
    const data = this._read(category);
    return {
      category,
      records: Object.keys(data.records || {}).length,
      metadata: { ...(data.metadata || {}) }
    };
  }

  _read(category) {
    const file = this.files[category];
    if (!file) throw new LearningStorageError(`Unknown learning category: ${category}`);
    return readJsonFile(file, () => ({
      version: 1,
      records: {},
      metadata: { createdAt: new Date(0).toISOString(), updatedAt: null, totalEvents: 0 }
    }), {
      createIfMissing: true,
      validate: value => value && value.version === 1 && value.records && typeof value.records === 'object'
    });
  }

  _write(category, data) {
    writeJsonAtomic(this.files[category], data, { backup: true });
  }

  _key(event) {
    const base = `${event.category}:${event.key}`;
    if (base.length <= 140) return base;
    return `${event.category}:${crypto.createHash('sha256').update(base).digest('hex')}`;
  }

  _storageCategory(category) {
    return {
      preference: 'preferences',
      alias: 'aliases',
      correction: 'corrections',
      habit: 'habits',
      pattern: 'patterns',
      statistic: 'statistics',
      workflow: 'workflows',
      feedback: 'feedback',
      conversation: 'conversation'
    }[String(category || '').toLowerCase()] || '';
  }

  _prune(data) {
    const entries = Object.entries(data.records || {});
    if (entries.length <= this.maxRecords) return;
    const keep = new Set(entries
      .sort((left, right) => Date.parse(right[1].updatedAt || 0) - Date.parse(left[1].updatedAt || 0))
      .slice(0, this.maxRecords)
      .map(([key]) => key));
    for (const key of Object.keys(data.records)) {
      if (!keep.has(key)) delete data.records[key];
    }
  }
}

module.exports = LearningStorage;
