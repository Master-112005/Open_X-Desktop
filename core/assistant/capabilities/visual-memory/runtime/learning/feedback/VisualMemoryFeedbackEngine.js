'use strict';

const { boundedPush, id, normalizeKey, nowIso } = require('../utils/learning-utils');

class VisualMemoryFeedbackEngine {
  constructor({ state, configuration, validator, events } = {}) {
    this.state = state;
    this.configuration = configuration;
    this.validator = validator;
    this.events = events;
  }

  record(input = {}) {
    const validation = this.validator.validateFeedback(input);
    if (!validation.valid) throw new Error(validation.reason);
    const event = {
      id: id('vmfeedback'),
      type: input.type,
      memoryId: input.memoryId || null,
      photoId: input.photoId || null,
      searchId: input.searchId || null,
      value: input.value ?? true,
      confidence: Number(input.confidence || this.configuration.sensitivity.feedback),
      source: input.source || 'visual-memory-interaction',
      metadata: { ...(input.metadata || {}) },
      createdAt: nowIso()
    };
    boundedPush(this.state.feedback, event, this.configuration.retention.maxEvents);
    this.events?.emit?.('visual-memory.learning.feedback.recorded', event);
    return event;
  }

  toLearningEvents(event) {
    const target = event.memoryId || event.photoId || event.searchId || event.type;
    return [{
      category: 'feedback',
      key: `visual-memory:${event.type}:${normalizeKey(target)}`,
      value: event.value,
      confidence: event.confidence,
      source: event.source,
      module: 'visual-memory.learning',
      metadata: event
    }];
  }
}

module.exports = VisualMemoryFeedbackEngine;
