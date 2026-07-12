'use strict';

const BaseInputAdapter = require('./BaseInputAdapter');

class VoiceAdapter extends BaseInputAdapter {
  constructor(options = {}) {
    super({ ...options, id: 'voice', source: 'voice', sourceType: 'voice-transcript', priority: options.priority ?? 95 });
  }

  extractText(payload = {}) {
    if (typeof payload === 'string') return payload;
    return String(payload.transcript ?? payload.normalizedTranscript ?? payload.text ?? payload.input ?? '');
  }

  normalizeMetadata(metadata = {}) {
    return {
      ...metadata,
      voiceConfidence: metadata.voiceConfidence ?? metadata.confidence ?? null,
      speechDurationMs: metadata.speechDurationMs ?? metadata.durationMs ?? null
    };
  }
}

module.exports = VoiceAdapter;
