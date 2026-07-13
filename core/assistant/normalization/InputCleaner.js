'use strict';

const BaseNormalizer = require('./BaseNormalizer');

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const INVISIBLE_CHARACTERS = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;

class InputCleaner extends BaseNormalizer {
  normalize(context) {
    const cleaned = String(context.workingText || '')
      .replace(/\r\n?/g, '\n')
      .replace(CONTROL_CHARACTERS, '')
      .replace(INVISIBLE_CHARACTERS, '');
    const maxLength = Math.max(1, Number(context.configuration?.maxInputLength) || cleaned.length || 1);
    const truncated = cleaned.length > maxLength;
    const next = truncated ? cleaned.slice(0, maxLength) : cleaned;
    if (truncated) {
      context.addWarning('Input was truncated by normalization maxInputLength.', {
        maxInputLength: maxLength,
        originalLength: cleaned.length
      });
    }
    return context.setText(next, this.id, {
      removedUnsupportedCharacters: context.workingText.length - cleaned.length,
      truncated,
      maxInputLength: maxLength
    });
  }
}

module.exports = InputCleaner;
