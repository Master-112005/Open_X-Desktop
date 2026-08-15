'use strict';

const LEAK_SNIFF_LIMIT = 4000;
const LEAK_OPENERS = Object.freeze({
  '[': ']',
  '(': ')'
});

function looksLikePrivateContext(value) {
  return /\b(?:private background context|relevant memory|recent conversation|current time|do not repeat this block)\b/i.test(String(value || ''));
}

function stripLeadingPrivateContext(value) {
  let text = String(value || '').trimStart();
  let changed = true;

  while (changed) {
    changed = false;
    const opener = text[0];
    const closer = LEAK_OPENERS[opener];
    if (!closer) break;

    const closeIndex = text.indexOf(closer);
    if (closeIndex <= 0) break;

    const block = text.slice(0, closeIndex + 1);
    if (!looksLikePrivateContext(block)) break;

    text = text.slice(closeIndex + 1).trimStart();
    changed = true;
  }

  return text.trim();
}

function createLeakGuard(onToken) {
  let buffer = '';
  let emitted = '';
  let sniffing = true;

  function emit(value) {
    if (!value) return;
    emitted += value;
    if (typeof onToken === 'function') {
      onToken(value);
    }
  }

  return {
    feed(chunk) {
      const text = String(chunk || '');
      if (!text) return;
      if (!sniffing) {
        emit(text);
        return;
      }

      buffer += text;
      const leadingTrimmed = buffer.trimStart();
      if (!leadingTrimmed) return;

      const opener = leadingTrimmed[0];
      const closer = LEAK_OPENERS[opener];
      if (!closer) {
        sniffing = false;
        emit(buffer);
        buffer = '';
        return;
      }

      const closeIndex = leadingTrimmed.indexOf(closer);
      if (closeIndex >= 0) {
        const block = leadingTrimmed.slice(0, closeIndex + 1);
        const rest = leadingTrimmed.slice(closeIndex + 1);
        sniffing = false;
        emit(looksLikePrivateContext(block) ? rest.trimStart() : buffer);
        buffer = '';
        return;
      }

      if (buffer.length >= LEAK_SNIFF_LIMIT) {
        sniffing = false;
        buffer = '';
      }
    },

    finalize(fullText = '') {
      if (emitted) {
        return stripLeadingPrivateContext(emitted);
      }
      return stripLeadingPrivateContext(fullText);
    }
  };
}

module.exports = {
  createLeakGuard,
  stripLeadingPrivateContext
};
