'use strict';

const SENSITIVE_KEYS = new Set([
  'audio',
  'pcm',
  'buffer',
  'sample',
  'samples',
  'transcript',
  'partialTranscript',
  'finalTranscript',
  'normalizedTranscript',
  'originalTranscript',
  'cleanedTranscript',
  'input',
  'text',
  'response',
  'password',
  'secret',
  'token'
]);

const SENSITIVE_KEY_PATTERN = /(?:pcm|buffer|samples?|transcript|input|text|response|utterance|speech|password|secret|token)/i;

function isSensitiveValue(key, raw) {
  if (SENSITIVE_KEYS.has(key)) return true;
  if (!SENSITIVE_KEY_PATTERN.test(key)) return false;
  return raw === null || typeof raw !== 'number' && typeof raw !== 'boolean';
}

function privateValueLength(raw) {
  if (typeof raw === 'string') return raw.length;
  if (Array.isArray(raw)) return raw.length;
  if (Buffer.isBuffer(raw)) return raw.length;
  if (ArrayBuffer.isView(raw)) return raw.byteLength;
  if (raw instanceof ArrayBuffer) return raw.byteLength;
  return 0;
}

function sanitizeMetadata(value, depth = 0) {
  if (depth > 4) return '[depth-limited]';
  if (Array.isArray(value)) return value.slice(0, 20).map(item => sanitizeMetadata(item, depth + 1));
  if (!value || typeof value !== 'object') return value;
  const sanitized = {};
  for (const [key, raw] of Object.entries(value)) {
    if (isSensitiveValue(key, raw)) {
      sanitized[`${key}Length`] = privateValueLength(raw);
      continue;
    }
    sanitized[key] = sanitizeMetadata(raw, depth + 1);
  }
  return sanitized;
}

module.exports = {
  SENSITIVE_KEYS,
  SENSITIVE_KEY_PATTERN,
  sanitizeMetadata
};
