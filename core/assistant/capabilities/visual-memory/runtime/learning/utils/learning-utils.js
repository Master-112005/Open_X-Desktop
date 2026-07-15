'use strict';

function nowIso() {
  return new Date().toISOString();
}

function id(prefix = 'vml') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function normalizeKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 120) || 'unknown';
}

function boundedPush(list, item, limit) {
  list.unshift(item);
  while (list.length > limit) list.pop();
  return item;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

module.exports = { boundedPush, clamp, id, normalizeKey, nowIso };
