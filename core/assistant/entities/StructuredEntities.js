'use strict';

const deepFreeze = require('../utils/ObjectFreeze');

const COLLECTIONS = Object.freeze([
  'applications',
  'browsers',
  'files',
  'folders',
  'paths',
  'websites',
  'contacts',
  'people',
  'devices',
  'media',
  'dates',
  'times',
  'durations',
  'reminders',
  'alarms',
  'timers',
  'locations',
  'windows',
  'networks',
  'volumeLevels',
  'brightnessLevels'
]);

class StructuredEntities {
  constructor(input = {}) {
    for (const key of COLLECTIONS) {
      this[key] = Array.isArray(input[key]) ? input[key].slice() : [];
    }
    this.entityGraph = input.entityGraph || { nodes: [], relationships: [] };
    this.relationships = Array.isArray(input.relationships) ? input.relationships.slice() : [];
    this.diagnostics = input.diagnostics || {};
    this.metadata = { ...(input.metadata || {}) };
    this.confidence = Math.max(0, Math.min(1, Number(input.confidence ?? 0)));
    this.entityCounts = Object.fromEntries(COLLECTIONS.map(key => [key, this[key].length]));
    this.primary = Object.fromEntries(COLLECTIONS
      .map(key => [key, this[key].slice().sort((left, right) => right.confidence - left.confidence)[0] || null])
      .filter(([, value]) => value));
    this.timing = { ...(input.timing || {}) };
    this.version = String(input.version || '6.0.0');
    this.futureExtensions = { ...(input.futureExtensions || {}) };
    deepFreeze(this);
  }
}

StructuredEntities.COLLECTIONS = COLLECTIONS;

module.exports = StructuredEntities;
