'use strict';

const BaseNormalizer = require('./BaseNormalizer');

function detectScript(text) {
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te';
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';
  if (/[\u4E00-\u9FFF]/.test(text)) return 'zh';
  return 'en';
}

function detectSegments(text) {
  const segments = [];
  let current = null;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const language = detectScript(char);
    if (!current || current.language !== language) {
      if (current) segments.push(current);
      current = { language, start: index, end: index + 1, text: char };
    } else {
      current.end = index + 1;
      current.text += char;
    }
  }
  if (current) segments.push(current);
  return segments.filter(segment => segment.text.trim().length > 0);
}

class LanguageSwitcher extends BaseNormalizer {
  normalize(context) {
    const text = String(context.workingText || '');
    const language = detectScript(text);
    const segments = detectSegments(text);
    context.language = {
      code: language,
      confidence: language === 'en' && segments.length <= 1 ? 0.7 : 0.85,
      detector: 'normalization.languageSwitcher'
    };
    segments.forEach(segment => context.addObservation('languageSegments', segment));
    if (segments.length === 0) {
      context.addObservation('languageSegments', { language, start: 0, end: text.length, text });
    }
    return context.setText(text, this.id, { language, segmentCount: Math.max(segments.length, 1) });
  }
}

module.exports = LanguageSwitcher;
