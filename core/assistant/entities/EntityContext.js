'use strict';

const StructuredEntities = require('./StructuredEntities');
const EntityDiagnostics = require('./EntityDiagnostics');

const TYPE_TO_COLLECTION = Object.freeze({
  application: 'applications',
  browser: 'browsers',
  file: 'files',
  folder: 'folders',
  path: 'paths',
  website: 'websites',
  contact: 'contacts',
  person: 'people',
  device: 'devices',
  media: 'media',
  date: 'dates',
  time: 'times',
  duration: 'durations',
  reminder: 'reminders',
  alarm: 'alarms',
  timer: 'timers',
  location: 'locations',
  window: 'windows',
  network: 'networks',
  volumeLevel: 'volumeLevels',
  brightnessLevel: 'brightnessLevels'
});

function pickText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return String(value.rawText || value.text || value.originalText || value.normalizedText || '');
}

class EntityContext {
  constructor({ semanticRepresentation = null, configuration = null, metadata = {}, timing = {} } = {}) {
    this.semanticRepresentation = semanticRepresentation || null;
    this.configuration = configuration || null;
    this.originalInput = pickText(semanticRepresentation?.originalInput) || pickText(semanticRepresentation?.normalizedInput?.originalInput) || pickText(semanticRepresentation?.normalizedInput);
    this.normalizedInput = pickText(semanticRepresentation?.normalizedInput) || this.originalInput;
    this.text = this.originalInput || this.normalizedInput;
    this.entities = {};
    for (const collection of StructuredEntities.COLLECTIONS) this.entities[collection] = [];
    this.relationships = [];
    this.entityGraph = { nodes: [], relationships: [] };
    this.diagnostics = new EntityDiagnostics();
    this.metadata = { ...(metadata || {}) };
    this.timing = { startedAt: Date.now(), finishedAt: null, durationMs: 0, ...(timing || {}) };
    this.futureExtensions = {};
  }

  addEntity(type, value, data = {}) {
    const collection = TYPE_TO_COLLECTION[type];
    if (!collection || value === null || value === undefined || String(value).trim() === '') return null;
    const entity = {
      id: `${type}:${this.entities[collection].length + 1}`,
      type,
      value: String(value).trim(),
      rawValue: String(data.rawValue || value).trim(),
      canonical: data.canonical ? String(data.canonical) : null,
      source: String(data.source || ''),
      confidence: Math.max(0, Math.min(1, Number(data.confidence ?? 0.75))),
      resolved: data.resolved || null,
      validation: data.validation || null,
      metadata: { ...(data.metadata || {}) }
    };
    this.entities[collection].push(entity);
    this.diagnostics.discovered(type);
    this.diagnostics.confidenceDistribution.push(entity.confidence);
    return entity;
  }

  allEntities() {
    return StructuredEntities.COLLECTIONS.flatMap(collection => this.entities[collection]);
  }

  addRelationship(relationship = {}) {
    this.relationships.push({
      type: String(relationship.type || 'related-to'),
      source: relationship.source || null,
      target: relationship.target || null,
      confidence: Math.max(0, Math.min(1, Number(relationship.confidence ?? 0.6))),
      metadata: { ...(relationship.metadata || {}) }
    });
    this.diagnostics.relationshipsBuilt += 1;
  }

  confidence() {
    const values = this.allEntities().map(entity => entity.confidence).filter(Number.isFinite);
    if (values.length === 0) return 0;
    return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(3));
  }

  toStructuredEntities() {
    this.timing.finishedAt = this.timing.finishedAt || Date.now();
    this.timing.durationMs = Math.max(0, this.timing.finishedAt - this.timing.startedAt);
    return new StructuredEntities({
      ...this.entities,
      entityGraph: this.entityGraph,
      relationships: this.relationships,
      diagnostics: this.diagnostics.toJSON(),
      metadata: this.metadata,
      confidence: this.confidence(),
      timing: this.timing,
      version: this.configuration?.version || '6.0.0',
      futureExtensions: this.futureExtensions
    });
  }
}

EntityContext.TYPE_TO_COLLECTION = TYPE_TO_COLLECTION;

module.exports = EntityContext;
