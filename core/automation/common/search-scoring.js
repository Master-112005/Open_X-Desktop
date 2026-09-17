const { Normalizer } = require('../../assistant/Data');

const FUZZY_SIM_THRESHOLD = 0.64;
const NEAR_EXACT_SIM_THRESHOLD = 0.82;
const MIN_WORD_CONTAINS_LENGTH = 3;

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordBoundaryContains(haystack, needle) {
  if (!needle || needle.length < 1) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(needle)}([^a-z0-9]|$)`).test(haystack);
}

function splitIdentifierTokens(value) {
  const chars = [...String(value || '')];
  const parts = [];
  let current = '';

  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    const prev = i > 0 ? chars[i - 1] : '';
    const next = i + 1 < chars.length ? chars[i + 1] : '';
    const isUpper = /[A-Z]/.test(ch);
    const isLower = /[a-z]/.test(ch);
    const isDigit = /\d/.test(ch);
    const isPunct = !isUpper && !isLower && !isDigit;

    const boundary =
      isPunct ||
      (isUpper && prev && /[a-z0-9]/.test(prev)) ||
      (isUpper && prev && /[A-Z]/.test(prev) && next && /[a-z]/.test(next)) ||
      (isDigit && prev && /[A-Za-z]/.test(prev)) ||
      (!isPunct && !isUpper && prev && /\d/.test(prev));

    if (current && boundary) {
      parts.push(current.toLowerCase());
      current = '';
    }
    if (!isPunct) {
      current += ch;
    }
  }

  if (current) {
    parts.push(current.toLowerCase());
  }

  return parts.filter(Boolean);
}

function acronymOf(tokens, maxLength = 6) {
  return tokens
    .map(token => token.charAt(0))
    .filter(Boolean)
    .join('')
    .slice(0, maxLength);
}

function fuzzySimilarity(queryToken, nameToken) {
  const maxLen = Math.max(queryToken.length, nameToken.length);
  const minLen = Math.min(queryToken.length, nameToken.length);
  if (maxLen < 4 || minLen < 3 || maxLen > 24) return 0;
  const distance = Normalizer.damerauLevenshtein(queryToken, nameToken);
  return 1 - (distance / maxLen);
}

function tokenQuality(queryToken, nameToken) {
  const q = String(queryToken || '').toLowerCase();
  const n = String(nameToken || '').toLowerCase();
  if (!q || !n) return { value: 0, nearExact: false };

  if (q === n) return { value: 1, nearExact: true };
  if (n.startsWith(q) && q.length >= 2) return { value: 0.95, nearExact: true };
  if (q.startsWith(n) && n.length >= 3 && q.length >= n.length + 1) return { value: 0.84, nearExact: true };
  if (q.length >= MIN_WORD_CONTAINS_LENGTH && wordBoundaryContains(n, q)) {
    return { value: 0.9, nearExact: true };
  }

  const sim = fuzzySimilarity(q, n);
  if (sim >= NEAR_EXACT_SIM_THRESHOLD) return { value: sim, nearExact: true };
  if (sim >= FUZZY_SIM_THRESHOLD) return { value: sim, nearExact: false };
  return { value: 0, nearExact: false };
}

function scoreName(query, name, options = {}) {
  const q = String(query || '').trim();
  const n = String(name || '').trim();
  if (!q || !n) return 0;

  const qNorm = Normalizer.normalizeText(q);
  const nNorm = Normalizer.normalizeText(n);
  if (!qNorm || !nNorm) return 0;

  if (qNorm === nNorm) return options.maxScore ?? 100;

  const qCompact = qNorm.replace(/\s+/g, '');
  const nCompact = nNorm.replace(/\s+/g, '');

  if (nNorm.startsWith(qNorm) && qNorm.length >= 2) return 92;
  if (qNorm.length >= MIN_WORD_CONTAINS_LENGTH && wordBoundaryContains(nNorm, qNorm)) return 86;
  if (qCompact.length >= 3 && qCompact === nCompact) return 88;
  if (qCompact.length >= 3 && nCompact.includes(qCompact)) return 80;
  if (qNorm.length >= 5 && nCompact && qNorm.includes(nCompact) && nCompact.length / qNorm.length >= 0.55) {
    return 74;
  }

  const qTokens = splitIdentifierTokens(q);
  const nTokens = splitIdentifierTokens(n);

  const acro = acronymOf(nTokens);
  if (acro && qCompact === acro) return 94;
  if (acro && acro.length >= 3 && qCompact.startsWith(acro)) return 86;

  const orderedMatches = [];
  const matchedValues = [];
  let matchedCount = 0;
  let nearExactCount = 0;

  for (const qToken of qTokens) {
    if (!qToken) continue;
    let best = { value: 0, nearExact: false };
    let bestIndex = -1;
    for (let ni = 0; ni < nTokens.length; ni += 1) {
      const quality = tokenQuality(qToken, nTokens[ni]);
      if (quality.value > best.value) {
        best = quality;
        bestIndex = ni;
      }
    }
    if (best.value > 0 && bestIndex >= 0) {
      matchedCount += 1;
      if (best.nearExact) nearExactCount += 1;
      matchedValues.push(best.value);
      orderedMatches.push(bestIndex);
    } else {
      orderedMatches.push(-1);
    }
  }

  if (matchedCount === 0) {
    if (Math.min(qNorm.length, nNorm.length) >= 5 && Normalizer.similarity(qNorm, nNorm) >= 0.6) {
      return 55;
    }
    return 0;
  }

  const coverage = matchedCount / qTokens.length;
  if (coverage < 0.75) {
    return 0;
  }

  const nameIndices = orderedMatches.filter(index => index >= 0);
  const monotonic = nameIndices.every((index, i) => i === 0 || index > nameIndices[i - 1]);
  const contiguous = monotonic && nameIndices.every((index, i) => i === 0 || index === nameIndices[i - 1] + 1);
  const nearExactRatio = nearExactCount / qTokens.length;

  const allStrong = matchedValues.every(value => value >= 0.83);
  const exactAny = matchedValues.some(value => value >= 1);
  const strongEnough = allStrong && (exactAny || Math.min(...matchedValues) >= 0.86);

  if (contiguous && coverage === 1 && nearExactRatio === 1 && strongEnough) {
    return 84;
  }

  const matchedNameTokenCount = new Set(nameIndices).size;
  const alignment = matchedNameTokenCount / nTokens.length;
  const score = 45 + Math.round(coverage * 20) + Math.round(alignment * 8);

  if (nearExactRatio < 0.8) {
    return Math.min(score, 70);
  }

  return Math.min(score, 80);
}

module.exports = {
  scoreName,
  tokenQuality,
  splitIdentifierTokens,
  acronymOf,
  wordBoundaryContains,
  FUZZY_SIM_THRESHOLD,
  NEAR_EXACT_SIM_THRESHOLD
};