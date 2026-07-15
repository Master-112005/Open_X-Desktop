'use strict';

function normalize(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function ordinalIndex(text) {
  const value = normalize(text);
  const words = {
    first: 0,
    second: 1,
    third: 2,
    fourth: 3,
    fifth: 4,
    sixth: 5,
    seventh: 6,
    eighth: 7,
    ninth: 8,
    tenth: 9
  };
  const word = Object.keys(words).find(key => new RegExp(`\\b${key}\\b`).test(value));
  if (word) return words[word];
  const numeric = value.match(/\b(\d+)(?:st|nd|rd|th)?\b/);
  return numeric ? Math.max(0, Number(numeric[1]) - 1) : -1;
}

function nowIso() {
  return new Date().toISOString();
}

function id(prefix = 'vmcap') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;
}

function topResult(search = {}, index = 0) {
  const results = Array.isArray(search.results) ? search.results : [];
  return results[index] || null;
}

module.exports = {
  id,
  normalize,
  nowIso,
  ordinalIndex,
  topResult
};
