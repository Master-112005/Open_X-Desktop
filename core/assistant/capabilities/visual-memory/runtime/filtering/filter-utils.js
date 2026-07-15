'use strict';

function getConstraintValues(visualQuery, keys = []) {
  const constraints = visualQuery?.constraints || {};
  return keys.flatMap(key => Array.isArray(constraints[key]) ? constraints[key] : [])
    .map(item => String(item.value || '').trim())
    .filter(Boolean);
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function containsAny(value, needles = []) {
  const haystack = normalize(value);
  return needles.some(needle => haystack.includes(normalize(needle)));
}

function candidateText(candidate, fields = []) {
  const values = [];
  for (const field of fields) {
    if (field === 'folder') values.push(candidate.folder?.label, candidate.folder?.path);
    else if (field === 'albums') values.push(...(candidate.albums || []).flatMap(album => [album.title, album.name, album.path]));
    else values.push(candidate.photo?.[field], candidate.metadata?.[field]);
  }
  return values.filter(Boolean).join(' ');
}

function dateValue(candidate) {
  return Date.parse(
    candidate.metadata?.createdAt ||
    candidate.photo?.createdAt ||
    candidate.metadata?.modifiedAt ||
    candidate.photo?.modifiedAt ||
    ''
  ) || null;
}

function monthIndex(name) {
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const normalized = normalize(name);
  return months.findIndex(month => month.startsWith(normalized.slice(0, 3)));
}

function dateRangeFromExpression(expression, now = new Date()) {
  const text = normalize(expression);
  if (!text) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayMs = 24 * 60 * 60 * 1000;
  if (text === 'today') return { start: today.getTime(), end: today.getTime() + dayMs - 1, label: expression };
  if (text === 'yesterday') return { start: today.getTime() - dayMs, end: today.getTime() - 1, label: expression };
  if (text === 'last week') return { start: today.getTime() - (7 * dayMs), end: today.getTime(), label: expression };
  if (text === 'last month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const end = new Date(now.getFullYear(), now.getMonth(), 1).getTime() - 1;
    return { start, end, label: expression };
  }
  if (text === 'last year') {
    const start = new Date(now.getFullYear() - 1, 0, 1).getTime();
    const end = new Date(now.getFullYear(), 0, 1).getTime() - 1;
    return { start, end, label: expression };
  }
  const year = text.match(/\b(19|20)\d{2}\b/)?.[0];
  const monthWord = text.split(/\s+/).find(part => monthIndex(part) >= 0);
  if (monthWord) {
    const month = monthIndex(monthWord);
    const rangeYear = year ? Number(year) : (/^last /.test(text) && month >= now.getMonth() ? now.getFullYear() - 1 : now.getFullYear());
    return {
      start: new Date(rangeYear, month, 1).getTime(),
      end: new Date(rangeYear, month + 1, 1).getTime() - 1,
      label: expression
    };
  }
  if (year) {
    const value = Number(year);
    return { start: new Date(value, 0, 1).getTime(), end: new Date(value + 1, 0, 1).getTime() - 1, label: expression };
  }
  if (text === 'summer') return { start: new Date(now.getFullYear(), 2, 1).getTime(), end: new Date(now.getFullYear(), 5, 30, 23, 59, 59).getTime(), label: expression };
  if (text === 'winter') return { start: new Date(now.getFullYear(), 10, 1).getTime(), end: new Date(now.getFullYear() + 1, 1, 28, 23, 59, 59).getTime(), label: expression };
  return null;
}

module.exports = {
  candidateText,
  containsAny,
  dateRangeFromExpression,
  dateValue,
  getConstraintValues,
  normalize
};
