'use strict';

const { LanguageDetectionError } = require('./AcquisitionErrors');

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

module.exports = LanguageDetector;
