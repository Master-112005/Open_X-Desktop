'use strict';

const InputFactory = require('./InputFactory');
const { InvalidInputError } = require('./AcquisitionErrors');
const { normalizeSourceName, sanitizeAcquisitionData } = require('./AcquisitionSanitizer');

class BaseInputAdapter {
  constructor(options = {}) {
    this.id = normalizeSourceName(String(options.id || this.constructor.name).replace(/Adapter$/, ''), 'adapter');
    this.source = normalizeSourceName(options.source || this.id, this.id);
    this.aliases = Object.freeze((options.aliases || []).map(value => normalizeSourceName(value, '')).filter(Boolean));
    this.sourceType = String(options.sourceType || this.source);
    this.priority = Number(options.priority) || 0;
    this.capabilities = Object.freeze([...(options.capabilities || ['text'])]);
    this.version = String(options.version || '1.0.0');
    this.inputFactory = options.inputFactory || new InputFactory(options);
    this.maxInputLength = Math.max(1, Number(options.maxInputLength) || 12000);
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
    if (text.length > this.maxInputLength) {
      throw new InvalidInputError('Input text is too long.', {
        source: this.source,
        adapterId: this.id,
        details: { maxInputLength: this.maxInputLength, actualLength: text.length }
      });
    }
    return true;
  }

  supports(sourceOrPayload) {
    const source = typeof sourceOrPayload === 'string'
      ? sourceOrPayload
      : sourceOrPayload?.source;
    const normalized = String(source || '').toLowerCase();
    return normalized === this.source || this.aliases.includes(normalized);
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
    return String(payload.input ?? payload.text ?? payload.command ?? payload.message ?? '');
  }

  normalizeMetadata(metadata = {}) {
    return sanitizeAcquisitionData(metadata || {});
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
