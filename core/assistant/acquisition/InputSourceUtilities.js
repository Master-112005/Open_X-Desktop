'use strict';

const { sanitizeDetails } = require('../utils');

function compactText(value, maxLength = 500) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

function normalizeSourceName(value, fallback = 'chat') {
  return compactText(value || fallback, 80).toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || fallback;
}

function clampConfidence(value, fallback = 0) {
  const number = Number(value);
  return Math.max(0, Math.min(1, Number.isFinite(number) ? number : fallback));
}

function sanitizeAcquisitionData(value) {
  return sanitizeDetails(value || {});
}

const SOURCE_ALIASES = Object.freeze({
  android: 'phone',
  copy: 'clipboard',
  desktop: 'chat',
  'desktop-voice': 'voice',
  extension: 'plugin',
  'image-text': 'ocr',
  ios: 'phone',
  mobile: 'phone',
  moblie: 'phone',
  mobiel: 'phone',
  mic: 'voice',
  microphone: 'voice',
  'mobile-cloud': 'cloud',
  paste: 'clipboard',
  relay: 'cloud',
  rest: 'api',
  screen: 'ocr',
  'screen-text': 'ocr',
  speech: 'voice',
  text: 'chat'
});

class SourceNormalizer {
  constructor(options = {}) {
    this.aliases = {
      ...SOURCE_ALIASES,
      ...(options.aliases || {})
    };
  }

  normalize(source = 'chat') {
    const key = normalizeSourceName(source, 'chat');
    return this.aliases[key] || key;
  }
}

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

module.exports = {
  AcquisitionSanitizer: {
    clampConfidence,
    compactText,
    normalizeSourceName,
    sanitizeAcquisitionData
  },
  BASE_CONFIDENCE,
  SOURCE_ALIASES,
  SourceConfidenceCalculator,
  SourceNormalizer,
  clampConfidence,
  compactText,
  normalizeSourceName,
  sanitizeAcquisitionData
};