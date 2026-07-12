'use strict';

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
    message: normalized.message,
    code: normalized.code || null,
    stack: normalized.stack || null
  };
}

module.exports = {
  normalizeError,
  serializeError
};
