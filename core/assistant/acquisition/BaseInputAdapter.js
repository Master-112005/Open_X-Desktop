'use strict';

const InputFactory = require('./InputFactory');
const { InvalidInputError } = require('./AcquisitionErrors');

class BaseInputAdapter {
  constructor(options = {}) {
    this.id = String(options.id || this.constructor.name).replace(/Adapter$/, '').toLowerCase();
    this.source = String(options.source || this.id);
    this.sourceType = String(options.sourceType || this.source);
    this.priority = Number(options.priority) || 0;
    this.capabilities = Object.freeze([...(options.capabilities || ['text'])]);
    this.version = String(options.version || '1.0.0');
    this.inputFactory = options.inputFactory || new InputFactory(options);
    this.initialized = false;
  }

  initialize() {
    this.initialized = true;
    return true;
  }

  validate(payload = {}) {
    const text = this.extractText(payload);
    if (typeof text !== 'string') {
      throw new InvalidInputError('Input text must be a string.', { source: this.source, adapterId: this.id });
    }
    return true;
  }

  supports(sourceOrPayload) {
    const source = typeof sourceOrPayload === 'string'
      ? sourceOrPayload
      : sourceOrPayload?.source;
    return String(source || '').toLowerCase() === this.source;
  }

  acquire(payload = {}) {
    this.validate(payload);
    return this.inputFactory.create({
      source: this.source,
      sourceType: this.sourceType,
      rawText: this.extractText(payload),
      payload,
      metadata: this.normalizeMetadata(payload.metadata || payload),
      attachments: payload.attachments,
      device: payload.device || payload.phoneContext || payload.deviceContext || null,
      platform: payload.platform || null,
      userContext: payload.userContext || {},
      flags: payload.flags || {},
      confidence: payload.confidence
    });
  }

  extractText(payload = {}) {
    if (typeof payload === 'string') return payload;
    return String(payload.input ?? payload.text ?? payload.command ?? payload.message ?? payload.transcript ?? '');
  }

  normalizeMetadata(metadata = {}) {
    return { ...(metadata || {}) };
  }

  cleanup() {
    return true;
  }

  destroy() {
    this.initialized = false;
    return true;
  }
}

module.exports = BaseInputAdapter;
