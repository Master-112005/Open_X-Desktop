'use strict';

const crypto = require('crypto');

function normalizeVector(vector = []) {
  const values = Array.isArray(vector) ? vector.map(Number).filter(Number.isFinite) : [];
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  return magnitude ? values.map(value => value / magnitude) : values;
}

function cosineSimilarity(left = [], right = []) {
  const a = normalizeVector(left);
  const b = normalizeVector(right);
  const length = Math.min(a.length, b.length);
  if (!length) return 0;
  let dot = 0;
  for (let index = 0; index < length; index += 1) dot += a[index] * b[index];
  return Math.max(-1, Math.min(1, dot));
}

function id(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function nowIso() {
  return new Date().toISOString();
}

module.exports = { cosineSimilarity, id, normalizeVector, nowIso };
