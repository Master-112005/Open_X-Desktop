'use strict';

const SENSITIVE_KEY_PATTERN = /(password|passcode|token|secret|api[_-]?key|private[_-]?key|otp|pin|credential)/i;

function compactText(value, maxLength = 500) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

function sanitizeDetails(value, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return compactText(value, 300);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    if (depth >= 3) return '[array]';
    return value.slice(0, 10).map(item => sanitizeDetails(item, depth + 1, seen));
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    if (depth >= 3) return '[object]';
    const output = {};
    for (const [key, item] of Object.entries(value).slice(0, 30)) {
      output[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : sanitizeDetails(item, depth + 1, seen);
    }
    return output;
  }
  return String(value);
}

function normalizeError(error, fallbackMessage = 'Unexpected pipeline error.') {
  if (error instanceof Error) return error;
  const normalized = new Error(error ? String(error) : fallbackMessage);
  normalized.original = error;
  return normalized;
}

function serializeError(error) {
  const normalized = normalizeError(error);
  return {
    name: normalized.name,
    message: compactText(normalized.message, 500),
    code: normalized.code || null,
    stack: normalized.stack || null,
    details: sanitizeDetails(normalized.details || normalized.context || null),
    cause: normalized.cause ? {
      name: normalized.cause.name || 'Error',
      message: compactText(normalized.cause.message || normalized.cause, 300),
      code: normalized.cause.code || null
    } : null
  };
}

module.exports = {
  normalizeError,
  sanitizeDetails,
  serializeError
};
