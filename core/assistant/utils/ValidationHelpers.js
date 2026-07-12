'use strict';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredString(value, fieldName) {
  const text = String(value || '').trim();
  if (!text) {
    throw new Error(`${fieldName || 'value'} is required.`);
  }
  return text;
}

function optionalObject(value, fallback = {}) {
  return isPlainObject(value) ? value : fallback;
}

module.exports = {
  isPlainObject,
  optionalObject,
  requiredString
};
