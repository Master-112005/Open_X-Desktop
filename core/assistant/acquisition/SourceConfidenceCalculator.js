'use strict';

const { clampConfidence } = require('./AcquisitionSanitizer');

const BASE_CONFIDENCE = Object.freeze({
  chat: 0.99,
  voice: 0.94,

  phone: 0.92,
  cloud: 0.86,
  plugin: 0.82,
  api: 0.8,
  ocr: 0.68,
  clipboard: 0.9
});

class SourceConfidenceCalculator {
  calculate({ source = 'chat', metadata = {}, explicitConfidence = null } = {}) {
    const explicit = Number(explicitConfidence ?? metadata.confidence ?? metadata.ocrConfidence);
    if (Number.isFinite(explicit)) return this.clamp(explicit);
    let confidence = BASE_CONFIDENCE[String(source || '').toLowerCase()] ?? 0.75;
    if (metadata.trusted === true) confidence += 0.05;
    if (metadata.encrypted === true) confidence += 0.03;
    if (metadata.connected === false) confidence -= 0.08;
    if (metadata.relayConnected === false) confidence -= 0.12;
    if (metadata.partial === true) confidence -= 0.18;
    if (metadata.mixedScript === true) confidence -= 0.04;
    return this.clamp(confidence);
  }

  clamp(value) {
    return clampConfidence(value, 0);
  }
}

module.exports = SourceConfidenceCalculator;
