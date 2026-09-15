'use strict';

const { RawUserInput } = require('../models');
const { IdGenerator } = require('../utils');

const {
  AdapterUnavailableError,
  AttachmentError,
  LanguageDetectionError
} = require('./AcquisitionErrors');
const {
  SourceConfidenceCalculator,
  compactText,
  sanitizeAcquisitionData
} = require('./InputSourceUtilities');

class AttachmentResolver {
  constructor(options = {}) {
    this.maxAttachments = Math.max(0, Number(options.maxAttachments) || 20);
  }

  resolve(attachments = [], source = 'unknown') {
    if (!attachments) return [];
    if (!Array.isArray(attachments)) {
      throw new AttachmentError('Attachments must be an array.', { source });
    }
    return attachments.slice(0, this.maxAttachments).map((attachment, index) => {
      const value = attachment && typeof attachment === 'object' ? attachment : {};
      return Object.freeze({
        id: compactText(value.id || value.identifier || `${source}_attachment_${index + 1}`, 120),
        name: compactText(value.name || value.filename || '', 180),
        type: compactText(value.type || 'unknown', 80),
        size: Math.max(0, Number(value.size || value.sizeBytes || 0)),
        mimeType: compactText(value.mimeType || value.mime || '', 120),
        source: compactText(value.source || source, 80),
        metadata: sanitizeAcquisitionData(value.metadata || {})
      });
    });
  }
}

class InputMetadataBuilder {
  build({ source = 'chat', payload = {}, metadata = {} } = {}) {
    const now = Date.now();
    const resolvedLocale = globalThis.Intl.DateTimeFormat().resolvedOptions();
    const timezone = resolvedLocale.timeZone || '';
    const safeMetadata = sanitizeAcquisitionData(metadata || {});
    return {
      inputSource: String(source || 'chat'),
      receivedTimestamp: Number(safeMetadata.receivedTimestamp || payload.timestamp) || now,
      processingTimestamp: now,
      locale: String(safeMetadata.locale || payload.locale || resolvedLocale.locale || 'en-US'),
      timezone,
      os: process.platform,
      applicationVersion: String(safeMetadata.applicationVersion || payload.applicationVersion || ''),
      protocolVersion: safeMetadata.protocolVersion || payload.protocolVersion || null,
      sourceReliability: safeMetadata.sourceReliability || null,
      ...(safeMetadata || {})
    };
  }
}

class LanguageDetector {
  detect(text = '', metadata = {}) {
    try {
      const value = String(text || '');
      const locale = String(metadata.locale || globalThis.Intl.DateTimeFormat().resolvedOptions().locale || 'en-US');
      let script = 'latin';
      let language = locale.split('-')[0] || 'en';
      let confidence = value.trim() ? 0.72 : 0.4;

      if (/[\u0900-\u097F]/.test(value)) {
        script = 'devanagari';
        language = 'hi';
        confidence = 0.82;
      } else if (/[\u0B80-\u0BFF]/.test(value)) {
        script = 'tamil';
        language = 'ta';
        confidence = 0.82;
      } else if (/[\u0C80-\u0CFF]/.test(value)) {
        script = 'kannada';
        language = 'kn';
        confidence = 0.82;
      } else if (/[\u0C00-\u0C7F]/.test(value)) {
        script = 'telugu';
        language = 'te';
        confidence = 0.82;
      } else if (/[\u0600-\u06FF]/.test(value)) {
        script = 'arabic';
        language = 'ar';
        confidence = 0.82;
      } else if (/[\u4E00-\u9FFF]/.test(value)) {
        script = 'han';
        language = 'zh';
        confidence = 0.82;
      } else if (/^[\x00-\x7F]*$/.test(value)) {
        language = 'en';
        confidence = value.trim() ? 0.78 : 0.4;
      }

      const mixedScript = /[a-z]/i.test(value) && script !== 'latin';
      return Object.freeze({ language, locale, script, confidence: mixedScript ? Math.max(0.5, confidence - 0.08) : confidence, mixedScript });
    } catch (error) {
      throw new LanguageDetectionError(error.message, { cause: error });
    }
  }
}

class InputAdapterRegistry {
  constructor() {
    this.adapters = new Map();
  }

  register(adapter, options = {}) {
    if (!adapter || typeof adapter.acquire !== 'function' || typeof adapter.supports !== 'function') {
      throw new AdapterUnavailableError('Input adapter must implement supports() and acquire().');
    }
    const id = String(options.id || adapter.id || adapter.source || '').trim();
    if (!id) throw new AdapterUnavailableError('Input adapter id is required.');
    adapter.id = id;
    if (Number.isFinite(options.priority)) adapter.priority = Number(options.priority);
    if (this.adapters.has(id) && options.replace !== true) {
      throw new AdapterUnavailableError(`Input adapter already registered: ${id}`, { adapterId: id });
    }
    this.adapters.set(id, adapter);
    return this;
  }

  unregister(id) {
    return this.adapters.delete(String(id || '').trim());
  }

  find(sourceOrPayload) {
    const candidates = [...this.adapters.values()]
      .filter(adapter => adapter.supports(sourceOrPayload))
      .sort((left, right) => (Number(right.priority) || 0) - (Number(left.priority) || 0));
    return candidates[0] || null;
  }

  get(id) {
    return this.adapters.get(String(id || '').trim()) || null;
  }

  count() {
    return this.adapters.size;
  }

  enumerate() {
    return [...this.adapters.values()]
      .sort((left, right) => (Number(right.priority) || 0) - (Number(left.priority) || 0))
      .map(adapter => ({
        id: adapter.id,
        source: adapter.source,
        sourceType: adapter.sourceType,
        priority: adapter.priority,
        capabilities: Array.isArray(adapter.capabilities) ? adapter.capabilities.slice() : [],
        version: adapter.version,
        health: adapter.initialized === false ? 'registered' : 'ready'
      }));
  }

  clear() {
    const count = this.adapters.size;
    this.adapters.clear();
    return count;
  }
}

class InputFactory {
  constructor(options = {}) {
    this.idGenerator = options.idGenerator || new IdGenerator({ prefix: 'input' });
    this.languageDetector = options.languageDetector || new LanguageDetector();
    this.attachmentResolver = options.attachmentResolver || new AttachmentResolver(options);
    this.metadataBuilder = options.metadataBuilder || new InputMetadataBuilder();
    this.confidenceCalculator = options.confidenceCalculator || new SourceConfidenceCalculator();
    this.maxRawTextLength = Math.max(1, Number(options.maxRawTextLength) || 12000);
  }

  create({
    source = 'chat',
    sourceType = '',
    rawText = '',
    payload = {},
    metadata = {},
    attachments = [],
    device = null,
    platform = null,
    userContext = {},
    flags = {},
    confidence = null
  } = {}) {
    const safeRawText = String(rawText || '').slice(0, this.maxRawTextLength);
    const builtMetadata = this.metadataBuilder.build({ source, payload, metadata });
    const language = this.languageDetector.detect(safeRawText, builtMetadata);
    const resolvedAttachments = this.attachmentResolver.resolve(attachments || payload.attachments || [], source);
    const requestId = String(payload.requestId || builtMetadata.requestId || this.idGenerator.next('request'));
    return new RawUserInput({
      id: this.idGenerator.next('input'),
      requestId,
      conversationId: payload.conversationId || builtMetadata.conversationId || '',
      sessionId: payload.sessionId || builtMetadata.sessionId || '',
      timestamp: builtMetadata.receivedTimestamp || Date.now(),
      source,
      sourceType: sourceType || source,
      rawText: safeRawText,
      language,
      confidence: this.confidenceCalculator.calculate({ source, metadata: builtMetadata, explicitConfidence: confidence }),
      attachments: resolvedAttachments,
      metadata: builtMetadata,
      device,
      platform,
      userContext,
      flags,
      diagnostics: [{
        level: 'info',
        message: 'Input acquired.',
        data: {
          adapterSource: source,
          attachmentCount: resolvedAttachments.length,
          language: language.language,
          confidence: language.confidence
        },
        timestamp: Date.now()
      }],
      futureExtensions: {}
    });
  }
}

module.exports = {
  AttachmentResolver,
  InputAdapterRegistry,
  InputFactory,
  InputMetadataBuilder,
  LanguageDetector
};