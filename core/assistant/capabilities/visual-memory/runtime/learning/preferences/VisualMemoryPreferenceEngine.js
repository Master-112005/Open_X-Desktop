'use strict';

const { boundedPush, id, normalizeKey, nowIso } = require('../utils/learning-utils');

class VisualMemoryPreferenceEngine {
  constructor({ state, configuration, validator, events } = {}) {
    this.state = state;
    this.configuration = configuration;
    this.validator = validator;
    this.events = events;
  }

  set(input = {}) {
    const validation = this.validator.validatePreference(input);
    if (!validation.valid) throw new Error(validation.reason);
    const key = normalizeKey(input.key);
    const record = {
      id: id('vmpref'),
      key,
      value: input.value,
      type: input.type || 'preference',
      confidence: Number(input.confidence || this.configuration.sensitivity.preference),
      source: input.source || 'visual-memory-preference',
      updatedAt: nowIso(),
      reversible: true
    };
    this.state.preferences[key] = record;
    boundedPush(this.state.history, { action: 'preference-set', record, createdAt: nowIso() }, this.configuration.retention.maxEvents);
    this.events?.emit?.('visual-memory.learning.preference.recorded', record);
    return record;
  }

  delete(key) {
    const normalized = normalizeKey(key);
    const existing = this.state.preferences[normalized] || null;
    delete this.state.preferences[normalized];
    return existing;
  }

  toLearningEvents(record) {
    return [{
      category: 'preference',
      key: `visual-memory:${record.key}`,
      value: record.value,
      confidence: record.confidence,
      source: record.source,
      module: 'visual-memory.learning',
      metadata: record
    }];
  }
}

module.exports = VisualMemoryPreferenceEngine;
