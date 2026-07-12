'use strict';

const MemoryDiagnostics = require('./MemoryDiagnostics');
const ResolvedContext = require('./ResolvedContext');

function allEntities(structuredEntities) {
  if (!structuredEntities || typeof structuredEntities !== 'object') return [];
  return [
    'applications', 'browsers', 'files', 'folders', 'paths', 'websites', 'contacts',
    'people', 'devices', 'media', 'dates', 'times', 'durations', 'reminders',
    'alarms', 'timers', 'locations', 'windows', 'networks', 'volumeLevels',
    'brightnessLevels'
  ].flatMap(key => Array.isArray(structuredEntities[key]) ? structuredEntities[key] : []);
}

function inputText(structuredEntities, metadata = {}) {
  return String(
    metadata.rawInput ||
    metadata.input ||
    metadata.normalizedInput ||
    structuredEntities?.metadata?.rawInput ||
    structuredEntities?.metadata?.input ||
    structuredEntities?.metadata?.normalizedInput ||
    ''
  );
}

class MemoryContext {
  constructor({ structuredEntities = null, configuration = null, state = null, metadata = {}, snapshots = {} } = {}) {
    this.structuredEntities = structuredEntities || null;
    this.configuration = configuration || null;
    this.state = state || {};
    this.metadata = { ...(metadata || {}) };
    this.snapshots = { ...(snapshots || {}) };
    this.input = inputText(structuredEntities, this.metadata);
    this.entities = allEntities(structuredEntities);
    this.workingMemory = {};
    this.conversationMemory = {};
    this.sessionMemory = {};
    this.dialogueHistory = [];
    this.topic = null;
    this.references = [];
    this.resolvedReferences = [];
    this.resolvedAliases = [];
    this.resolvedPronouns = [];
    this.context = {
      application: {},
      runningApplications: [],
      desktopState: {},
      browserState: {},
      screen: {},
      clipboard: {},
      selections: {},
      windows: {},
      system: {},
      media: {},
      calendar: {},
      time: {},
      user: {}
    };
    this.diagnostics = new MemoryDiagnostics();
    this.timing = { startedAt: Date.now(), finishedAt: null, durationMs: 0 };
    this.futureExtensions = {};
  }

  latestEntity(types = []) {
    const allowed = new Set(types);
    return this.entities.find(entity => allowed.has(entity.type)) || null;
  }

  confidence() {
    const resolved = this.resolvedReferences.length + this.resolvedAliases.length + this.resolvedPronouns.length;
    const refs = Math.max(1, this.references.length);
    const entityConfidence = this.entities.length
      ? this.entities.reduce((sum, entity) => sum + Number(entity.confidence || 0), 0) / this.entities.length
      : 0;
    return Number(Math.max(entityConfidence, resolved / refs).toFixed(3));
  }

  toResolvedContext() {
    this.timing.finishedAt = this.timing.finishedAt || Date.now();
    this.timing.durationMs = Math.max(0, this.timing.finishedAt - this.timing.startedAt);
    return new ResolvedContext({
      workingMemory: this.workingMemory,
      conversationMemory: this.conversationMemory,
      sessionMemory: this.sessionMemory,
      dialogueHistory: this.dialogueHistory,
      topic: this.topic,
      resolvedReferences: this.resolvedReferences,
      resolvedAliases: this.resolvedAliases,
      resolvedPronouns: this.resolvedPronouns,
      ...this.context,
      metadata: this.metadata,
      diagnostics: this.diagnostics.toJSON(),
      confidence: this.confidence(),
      timing: this.timing,
      version: this.configuration?.version || '7.0.0',
      futureExtensions: this.futureExtensions
    });
  }
}

module.exports = MemoryContext;
