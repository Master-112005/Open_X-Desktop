'use strict';

const BaseNormalizer = require('./BaseNormalizer');

function detectScript(text) {
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';
  return 'en';
}

class LanguageSwitcher extends BaseNormalizer {
  normalize(context) {
    const text = String(context.workingText || '');
    const language = detectScript(text);
    context.language = {
      code: language,
      confidence: language === 'en' ? 0.7 : 0.85,
      detector: 'normalization.languageSwitcher'
    };
    context.addObservation('languageSegments', {
      language,
      start: 0,
      end: text.length,
      text
    });
    return context.setText(text, this.id, { language });
  }
}

module.exports = LanguageSwitcher;
