'use strict';

const { sanitizeDetails } = require('../utils/ErrorHelpers');

function compactText(value, maxLength = 500) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

function normalizeSourceName(value, fallback = 'chat') {
  return compactText(value || fallback, 80).toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || fallback;
}

function clampConfidence(value, fallback = 0) {
  const number = Number(value);
  return Math.max(0, Math.min(1, Number.isFinite(number) ? number : fallback));
}

function sanitizeAcquisitionData(value) {
  return sanitizeDetails(value || {});
}

module.exports = {
  clampConfidence,
  compactText,
  normalizeSourceName,
  sanitizeAcquisitionData
};
