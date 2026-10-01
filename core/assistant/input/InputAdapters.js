'use strict';

const { InvalidInputError } = require('./AcquisitionErrors');
const { normalizeSourceName, sanitizeAcquisitionData } = require('./InputSourceUtilities');
const { InputFactory } = require('./InputBuilders');

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

class ChatAdapter extends BaseInputAdapter {
  constructor(options = {}) {
    super({
      ...options,
      id: 'chat',
      source: 'chat',
      aliases: ['desktop', 'text'],
      sourceType: 'desktop-chat',
      priority: options.priority ?? 100,
      capabilities: ['text', 'typed-command']
    });
  }
}

class VoiceAdapter extends BaseInputAdapter {
  constructor(options = {}) {
    super({
      ...options,
      id: 'voice',
      source: 'voice',
      aliases: ['desktop-voice', 'speech', 'microphone', 'mic'],
      sourceType: 'desktop-voice',
      priority: options.priority ?? 98,
      capabilities: ['text', 'speech-transcript', 'voice-command']
    });
  }
}

class PhoneAdapter extends BaseInputAdapter {
  constructor(options = {}) {
    super({
      ...options,
      id: 'phone',
      source: 'phone',
      aliases: ['mobile', 'android', 'ios'],
      sourceType: 'mobile-phone',
      priority: options.priority ?? 90,
      capabilities: ['text', 'mobile-command', 'device-context']
    });
  }

  normalizeMetadata(metadata = {}) {
    return {
      ...metadata,
      deviceType: metadata.deviceType || 'phone',
      phoneDeviceId: metadata.deviceId || metadata.phoneDeviceId || null,
      sessionId: metadata.sessionId || null,
      connected: metadata.connected !== false
    };
  }
}

class CloudAdapter extends BaseInputAdapter {
  constructor(options = {}) {
    super({
      ...options,
      id: 'cloud',
      source: 'cloud',
      aliases: ['relay', 'mobile-cloud'],
      sourceType: 'cloud-relay',
      priority: options.priority ?? 85,
      capabilities: ['text', 'cloud-command']
    });
  }

  extractText(payload = {}) {
    if (typeof payload === 'string') return payload;
    return String(payload.command ?? payload.payload?.command ?? payload.message ?? payload.text ?? payload.input ?? '');
  }

  normalizeMetadata(metadata = {}) {
    return {
      ...metadata,
      cloudSession: metadata.cloudSession || metadata.cloudRequestId || null,
      relay: metadata.relay || metadata.relayUrl || null,
      encrypted: metadata.encrypted === true,
      relayConnected: metadata.relayConnected !== false
    };
  }
}

class PluginAdapter extends BaseInputAdapter {
  constructor(options = {}) {
    super({
      ...options,
      id: 'plugin',
      source: 'plugin',
      aliases: ['extension'],
      sourceType: 'plugin-request',
      priority: options.priority ?? 70,
      capabilities: ['text', 'plugin-command']
    });
  }

  normalizeMetadata(metadata = {}) {
    return {
      ...metadata,
      pluginId: metadata.pluginId || metadata.id || null,
      permissionScope: metadata.permissionScope || null,
      trusted: metadata.trusted === true
    };
  }
}

class APIAdapter extends BaseInputAdapter {
  constructor(options = {}) {
    super({
      ...options,
      id: 'api',
      source: 'api',
      aliases: ['rest', 'http'],
      sourceType: 'future-api',
      priority: options.priority ?? 60,
      capabilities: ['text', 'structured-command']
    });
  }
}

class OCRAdapter extends BaseInputAdapter {
  constructor(options = {}) {
    super({
      ...options,
      id: 'ocr',
      source: 'ocr',
      aliases: ['image-text', 'screen-text'],
      sourceType: 'ocr-text',
      priority: options.priority ?? 50,
      capabilities: ['text', 'ocr']
    });
  }

  extractText(payload = {}) {
    if (typeof payload === 'string') return payload;
    return String(payload.extractedText ?? payload.text ?? payload.input ?? '');
  }

  normalizeMetadata(metadata = {}) {
    return {
      ...metadata,
      ocrConfidence: metadata.ocrConfidence ?? metadata.confidence ?? null,
      imageSource: metadata.imageSource || null,
      partial: metadata.partial === true
    };
  }
}

class ClipboardAdapter extends BaseInputAdapter {
  constructor(options = {}) {
    super({
      ...options,
      id: 'clipboard',
      source: 'clipboard',
      aliases: ['copy', 'paste'],
      sourceType: 'clipboard',
      priority: options.priority ?? 55,
      capabilities: ['text', 'clipboard']
    });
  }

  extractText(payload = {}) {
    if (typeof payload === 'string') return payload;
    return String(payload.clipboardText ?? payload.text ?? payload.input ?? '');
  }

  normalizeMetadata(metadata = {}) {
    return {
      ...metadata,
      clipboardSource: metadata.clipboardSource || null,
      clipboardType: metadata.clipboardType || 'text',
      partial: metadata.partial === true
    };
  }
}

const ALL_INPUT_ADAPTERS = Object.freeze([
  ChatAdapter,
  VoiceAdapter,
  PhoneAdapter,
  CloudAdapter,
  PluginAdapter,
  APIAdapter,
  OCRAdapter,
  ClipboardAdapter
]);

module.exports = {
  ALL_INPUT_ADAPTERS,
  APIAdapter,
  BaseInputAdapter,
  ChatAdapter,
  ClipboardAdapter,
  CloudAdapter,
  OCRAdapter,
  PhoneAdapter,
  PluginAdapter,
  VoiceAdapter
};