'use strict';

const BaseNormalizer = require('./BaseNormalizer');

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const INVISIBLE_CHARACTERS = /[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;

class InputCleaner extends BaseNormalizer {
  normalize(context) {
    const next = String(context.workingText || '')
      .replace(/\r\n?/g, '\n')
      .replace(CONTROL_CHARACTERS, '')
      .replace(INVISIBLE_CHARACTERS, '');
    return context.setText(next, this.id, { removedUnsupportedCharacters: context.workingText.length - next.length });
  }
}

module.exports = InputCleaner;
