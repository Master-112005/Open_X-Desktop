'use strict';

const BaseNormalizer = require('./BaseNormalizer');

const EMOJI_MEANINGS = Object.freeze({
  '\u{1F4E7}': 'email',
  '\u{1F4E8}': 'message',
  '\u{1F4C1}': 'folder',
  '\u{1F4C2}': 'folder',
  '\u{1F50A}': 'volume',
  '\u{1F50D}': 'search',
  '\u{1F642}': 'happy',
  '\u{1F60A}': 'happy'
});

class EmojiInterpreter extends BaseNormalizer {
  normalize(context) {
    let next = String(context.workingText || '');
    Object.keys(EMOJI_MEANINGS).forEach(emoji => {
      if (!next.includes(emoji)) return;
      const meaning = EMOJI_MEANINGS[emoji];
      context.addObservation('emojis', { emoji, meaning });
      next = next.split(emoji).join(` ${emoji} ${meaning} `);
    });
    return context.setText(next.replace(/[ \t]{2,}/g, ' ').trim(), this.id);
  }
}

module.exports = EmojiInterpreter;
