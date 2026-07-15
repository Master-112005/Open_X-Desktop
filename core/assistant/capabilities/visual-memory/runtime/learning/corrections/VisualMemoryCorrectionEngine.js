'use strict';

const { boundedPush, id, normalizeKey, nowIso } = require('../utils/learning-utils');

class VisualMemoryCorrectionEngine {
  constructor({ state, configuration, validator, events } = {}) {
    this.state = state;
    this.configuration = configuration;
    this.validator = validator;
    this.events = events;
  }

  record(input = {}) {
    const validation = this.validator.validateCorrection(input);
    if (!validation.valid) throw new Error(validation.reason);
    const correction = {
      id: id('vmcorrection'),
      type: input.type,
      memoryId: input.memoryId || null,
      photoId: input.photoId || null,
      identityId: input.identityId || null,
      from: input.from ?? null,
      to: input.to ?? null,
      reason: input.reason || '',
      confidence: Number(input.confidence || this.configuration.sensitivity.correction),
      reversible: true,
      undone: false,
      createdAt: nowIso()
    };
    boundedPush(this.state.corrections, correction, this.configuration.retention.maxCorrections);
    this.events?.emit?.('visual-memory.learning.correction.recorded', correction);
    return correction;
  }

  toLearningEvents(correction) {
    const target = correction.memoryId || correction.photoId || correction.identityId;
    return [{
      category: 'correction',
      key: `visual-memory:${correction.type}:${normalizeKey(target)}`,
      value: { from: correction.from, to: correction.to },
      confidence: correction.confidence,
      source: 'explicit-visual-memory-correction',
      module: 'visual-memory.learning',
      metadata: correction
    }];
  }
}

module.exports = VisualMemoryCorrectionEngine;
