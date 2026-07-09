'use strict';

const { LanguageDetectionError } = require('./AcquisitionErrors');

class LanguageDetector {
  detect(text = '', metadata = {}) {
    try {
      const value = String(text || '');
      const locale = String(metadata.locale || Intl.DateTimeFormat().resolvedOptions().locale || 'en-US');
      let script = 'latin';
      let language = locale.split('-')[0] || 'en';
      let confidence = value.trim() ? 0.72 : 0.4;

      if (/[\u0900-\u097F]/.test(value)) {
        script = 'devanagari';
        language = 'hi';
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

      return Object.freeze({ language, locale, script, confidence });
    } catch (error) {
      throw new LanguageDetectionError(error.message, { cause: error });
    }
  }
}

module.exports = LanguageDetector;
