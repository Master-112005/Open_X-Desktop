'use strict';

function nowIso() {
  return new Date().toISOString();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function stableId(prefix, value) {
  return `${prefix}:${String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown'}`;
}

function photoTimestamp(photo = {}, metadata = {}) {
  return Date.parse(photo.createdAt || metadata.createdAt || metadata.takenAt || photo.updatedAt || metadata.updatedAt || 0) || 0;
}

function groupBy(items, getKey) {
  const groups = {};
  for (const item of items) {
    const key = getKey(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  return groups;
}

function pageItems(items, { page = 1, pageSize = 96 } = {}) {
  const normalizedPage = Math.max(1, Number(page || 1));
  const normalizedPageSize = Math.max(1, Number(pageSize || 96));
  const start = (normalizedPage - 1) * normalizedPageSize;
  return {
    items: items.slice(start, start + normalizedPageSize),
    page: normalizedPage,
    pageSize: normalizedPageSize,
    total: items.length,
    hasMore: start + normalizedPageSize < items.length
  };
}

function unique(values) {
  return Array.from(new Set(asArray(values).filter(Boolean)));
}

module.exports = {
  asArray,
  groupBy,
  nowIso,
  pageItems,
  photoTimestamp,
  stableId,
  unique
};
