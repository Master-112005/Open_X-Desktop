'use strict';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
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

function optionalArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampNumber(value, min, max, fallback = min) {
  const number = finiteNumber(value, fallback);
  return Math.max(min, Math.min(max, number));
}

function compactString(value, maxLength = 240) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

module.exports = {
  clampNumber,
  compactString,
  finiteNumber,
  isPlainObject,
  optionalArray,
  optionalObject,
  requiredString
};
