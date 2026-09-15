'use strict';

const { deepFreeze } = require('../utils');
const { Normalizer } = require('../Data');
const { repairKnownTokenText } = require('../normalization/AssistantLexicon');

class EntityError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.context = details.context || null;
    this.diagnostics = details.diagnostics || [];
    this.code = details.code || this.constructor.name;
    this.timestamp = Date.now();
    if (details.cause) this.cause = details.cause;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      diagnostics: this.diagnostics,
      timestamp: this.timestamp
    };
  }
}

class EntityExtractionError extends EntityError {}
class EntityResolutionError extends EntityError {}
class EntityValidationError extends EntityError {}
class EntityGraphError extends EntityError {}
class ConfigurationError extends EntityError {}
class ExtractorExecutionError extends EntityError {}

const DEFAULT_EXTRACTOR_OPTIONS = Object.freeze({
  enabled: true,
  priority: 100,
  languages: ['*'],
  confidenceThreshold: 0.45
});

class EntityConfiguration {
  constructor(options = {}) {
    const input = options || {};
    this.enabled = input.enabled !== false;
    this.version = String(input.version || '6.0.0');
    this.locale = String(input.locale || 'en-US');
    this.strict = input.strict === true;
    this.confidenceThreshold = Math.max(0, Math.min(1, Number(input.confidenceThreshold ?? 0.45)));
    this.maxEntitiesPerType = Number.isFinite(input.maxEntitiesPerType) ? Math.max(1, Number(input.maxEntitiesPerType)) : 50;
    this.deduplicate = input.deduplicate !== false;
    this.captureSourcePositions = input.captureSourcePositions !== false;
    this.extractors = { ...(input.extractors || {}) };
    this.normalizers = { ...(input.normalizers || {}) };
    this.resolvers = { ...(input.resolvers || {}) };
    this.validators = { ...(input.validators || {}) };
    this.entityTypes = { ...(input.entityTypes || {}) };
    this.providers = { ...(input.providers || {}) };
    this.dictionaries = { ...(input.dictionaries || {}) };
  }

  getExtractorOptions(id, defaults = {}) {
    return {
      ...DEFAULT_EXTRACTOR_OPTIONS,
      ...(defaults || {}),
      ...(this.extractors[String(id || '')] || {})
    };
  }

  isExtractorEnabled(id) {
    return this.enabled && this.getExtractorOptions(id).enabled !== false;
  }

  toJSON() {
    return {
      enabled: this.enabled,
      version: this.version,
      locale: this.locale,
      strict: this.strict,
      confidenceThreshold: this.confidenceThreshold,
      maxEntitiesPerType: this.maxEntitiesPerType,
      deduplicate: this.deduplicate,
      captureSourcePositions: this.captureSourcePositions,
      extractors: { ...this.extractors },
      entityTypes: { ...this.entityTypes }
    };
  }
}

const MAX_DIAGNOSTIC_ITEMS = 100;

function pushBounded(list, item) {
  list.push(item);
  if (list.length > MAX_DIAGNOSTIC_ITEMS) list.splice(0, list.length - MAX_DIAGNOSTIC_ITEMS);
}

class EntityDiagnostics {
  constructor() {
    this.extractionTimes = {};
    this.entitiesDiscovered = {};
    this.relationshipsBuilt = 0;
    this.unknownEntities = [];
    this.duplicateEntities = [];
    this.confidenceDistribution = [];
    this.validation = { valid: true, entityCount: 0, issueCount: 0 };
    this.warnings = [];
    this.errors = [];
    this.pipelineOrder = [];
    this.memoryUsage = this._memoryUsage();
    this.finishedMemoryUsage = null;
  }

  time(id, durationMs) {
    this.extractionTimes[String(id || '')] = Math.max(0, Number(durationMs) || 0);
  }

  discovered(type) {
    const key = String(type || 'unknown');
    this.entitiesDiscovered[key] = (this.entitiesDiscovered[key] || 0) + 1;
  }

  warn(message, data = {}) {
    pushBounded(this.warnings, { message: String(message || ''), data, timestamp: Date.now() });
  }

  error(error, data = {}) {
    pushBounded(this.errors, {
      name: error?.name || 'Error',
      message: String(error?.message || error || ''),
      stack: error?.stack || '',
      data,
      timestamp: Date.now()
    });
  }

  _memoryUsage() {
    return typeof process !== 'undefined' && typeof process.memoryUsage === 'function'
      ? process.memoryUsage()
      : null;
  }

  finish() {
    this.finishedMemoryUsage = this._memoryUsage();
    return this;
  }

  toJSON() {
    this.finish();
    return {
      extractionTimes: { ...this.extractionTimes },
      entitiesDiscovered: { ...this.entitiesDiscovered },
      relationshipsBuilt: this.relationshipsBuilt,
      unknownEntities: this.unknownEntities.slice(),
      duplicateEntities: this.duplicateEntities.slice(),
      confidenceDistribution: this.confidenceDistribution.slice(),
      validation: { ...this.validation },
      warnings: this.warnings.slice(),
      errors: this.errors.slice(),
      pipelineOrder: this.pipelineOrder.slice(),
      memoryUsage: this.memoryUsage,
      finishedMemoryUsage: this.finishedMemoryUsage
    };
  }
}

class EntityLogger {
  constructor(logger = null) {
    this.logger = logger || null;
  }

  _safeData(data) {
    if (!data || typeof data !== 'object') return data;
    const copy = { ...data };
    for (const key of Object.keys(copy)) {
      if (/(password|token|secret|key|phone|email)/i.test(key)) copy[key] = '[REDACTED]';
    }
    return copy;
  }

  debug(message, data) { this.logger?.debug?.(message, this._safeData(data)); }
  info(message, data) { this.logger?.info?.(message, this._safeData(data)); }
  warn(message, data) { this.logger?.warn?.(message, this._safeData(data)); }
  error(message, data) { this.logger?.error?.(message, this._safeData(data)); }
}

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

function customEntityStore(target) {
  if (!target.futureExtensions.customEntities) target.futureExtensions.customEntities = {};
  return target.futureExtensions.customEntities;
}

class EntityContext {
  constructor({ semanticRepresentation = null, configuration = null, registry = null, metadata = {}, timing = {} } = {}) {
    this.semanticRepresentation = semanticRepresentation || null;
    this.configuration = configuration || null;
    this.registry = registry || null;
    this.originalInput = pickText(semanticRepresentation?.originalInput) || pickText(semanticRepresentation?.normalizedInput?.originalInput) || pickText(semanticRepresentation?.normalizedInput);
    this.normalizedInput = pickText(semanticRepresentation?.normalizedInput) || this.originalInput;
    this.text = this.originalInput || this.normalizedInput;
    this.entities = {};
    for (const collection of StructuredEntities.COLLECTIONS) this.entities[collection] = [];
    this.relationships = [];
    this.entityGraph = { nodes: [], relationships: [] };
    this.diagnostics = new EntityDiagnostics();
    this.metadata = {
      ...(semanticRepresentation?.metadata || {}),
      ...(metadata || {}),
      rawInput: this.originalInput,
      normalizedInput: this.normalizedInput,
      semanticVersion: semanticRepresentation?.version || null
    };
    this.timing = { startedAt: Date.now(), finishedAt: null, durationMs: 0, ...(timing || {}) };
    this.futureExtensions = {};
    if (this.registry?.entityTypes?.size) {
      this.futureExtensions.entityTypes = Object.fromEntries(this.registry.entityTypes.entries());
    }
  }

  _collectionForType(type) {
    const normalizedType = String(type || '').trim();
    const configured = this.configuration?.entityTypes?.[normalizedType] || this.registry?.entityTypes?.get?.(normalizedType) || {};
    return TYPE_TO_COLLECTION[normalizedType] || configured.collection;
  }

  _entityKey(type, value, canonical = null) {
    return `${String(type || '').trim().toLowerCase()}:${String(canonical || value || '').trim().toLowerCase()}`;
  }

  addEntity(type, value, data = {}) {
    const normalizedType = String(type || '').trim();
    const collection = this._collectionForType(normalizedType);
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const target = StructuredEntities.COLLECTIONS.includes(collection)
      ? this.entities[collection]
      : (customEntityStore(this)[normalizedType] ||= []);
    const canonical = data.canonical ? String(data.canonical) : null;
    const key = this._entityKey(normalizedType, value, canonical);
    const existing = target.find(entity => this._entityKey(entity.type, entity.value, entity.canonical) === key);
    if (existing) {
      this.diagnostics.duplicateEntities.push({ type: normalizedType, value: String(value).trim(), source: data.source || '' });
      const confidence = Math.max(0, Math.min(1, Number(data.confidence ?? 0.75)));
      if (confidence > existing.confidence) {
        existing.rawValue = String(data.rawValue || value).trim();
        existing.canonical = canonical || existing.canonical;
        existing.source = String(data.source || existing.source || '');
        existing.confidence = confidence;
        existing.metadata = { ...(existing.metadata || {}), ...(data.metadata || {}) };
      }
      return existing;
    }
    const entity = {
      id: `${normalizedType}:${target.length + 1}`,
      type: normalizedType,
      value: String(value).trim(),
      rawValue: String(data.rawValue || value).trim(),
      canonical,
      source: String(data.source || ''),
      confidence: Math.max(0, Math.min(1, Number(data.confidence ?? 0.75))),
      resolved: data.resolved || null,
      validation: data.validation || null,
      metadata: { ...(data.metadata || {}) }
    };
    target.push(entity);
    this.diagnostics.discovered(normalizedType);
    this.diagnostics.confidenceDistribution.push(entity.confidence);
    return entity;
  }

  compactEntities() {
    for (const collection of StructuredEntities.COLLECTIONS) {
      this.entities[collection] = this._dedupeCollection(this.entities[collection]);
    }
    const custom = this.futureExtensions.customEntities || {};
    for (const type of Object.keys(custom)) custom[type] = this._dedupeCollection(custom[type]);
    return this;
  }

  _dedupeCollection(entities) {
    const byKey = new Map();
    for (const entity of entities || []) {
      const key = this._entityKey(entity.type, entity.value, entity.canonical);
      const current = byKey.get(key);
      if (!current || entity.confidence > current.confidence) byKey.set(key, entity);
    }
    return [...byKey.values()].map((entity, index) => ({ ...entity, id: `${entity.type}:${index + 1}` }));
  }

  allEntities() {
    const custom = Object.values(this.futureExtensions.customEntities || {}).flat();
    return StructuredEntities.COLLECTIONS.flatMap(collection => this.entities[collection]).concat(custom);
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
    this.compactEntities();
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

class EntityRegistry {
  constructor() {
    this.extractors = new Map();
    this.normalizers = new Map();
    this.resolvers = new Map();
    this.validators = new Map();
    this.entityTypes = new Map();
  }

  registerExtractor(extractor, options = {}) {
    if (!extractor || typeof extractor.extract !== 'function') {
      throw new ConfigurationError('Entity extractor must provide extract(context).');
    }
    const id = String(options.id || extractor.id || extractor.constructor?.name || '').trim();
    if (!id) throw new ConfigurationError('Entity extractor id is required.');
    extractor.id = id;
    if (Number.isFinite(options.priority)) extractor.priority = Number(options.priority);
    if (options.enabled !== undefined) extractor.enabled = options.enabled !== false;
    this.extractors.set(id, extractor);
    return this;
  }

  registerNormalizer(id, normalizer) { this.normalizers.set(String(id), normalizer); return this; }
  registerResolver(id, resolver) { this.resolvers.set(String(id), resolver); return this; }
  registerValidator(id, validator) { this.validators.set(String(id), validator); return this; }
  registerEntityType(id, definition = {}) { this.entityTypes.set(String(id), { ...(definition || {}) }); return this; }
  getExtractor(id) { return this.extractors.get(String(id)) || null; }
  getNormalizer(id) { return this.normalizers.get(String(id)) || null; }
  getResolver(id) { return this.resolvers.get(String(id)) || null; }
  getValidator(id) { return this.validators.get(String(id)) || null; }
  getEntityType(id) { return this.entityTypes.get(String(id)) || null; }
  unregisterExtractor(id) { return this.extractors.delete(String(id)); }
  unregisterNormalizer(id) { return this.normalizers.delete(String(id)); }
  unregisterResolver(id) { return this.resolvers.delete(String(id)); }
  unregisterValidator(id) { return this.validators.delete(String(id)); }
  unregisterEntityType(id) { return this.entityTypes.delete(String(id)); }

  listExtractors({ includeDisabled = true } = {}) {
    return [...this.extractors.values()]
      .filter(extractor => includeDisabled || extractor.enabled !== false)
      .sort((left, right) => (Number(left.priority) || 0) - (Number(right.priority) || 0) || String(left.id).localeCompare(String(right.id)));
  }

  health() {
    return this.listExtractors().map(extractor => ({
      id: extractor.id,
      version: extractor.version,
      priority: extractor.priority,
      enabled: extractor.enabled !== false,
      initialized: extractor.initialized === true
    }));
  }

  clear() {
    const counts = {
      extractors: this.extractors.size,
      normalizers: this.normalizers.size,
      resolvers: this.resolvers.size,
      validators: this.validators.size,
      entityTypes: this.entityTypes.size
    };
    this.extractors.clear();
    this.normalizers.clear();
    this.resolvers.clear();
    this.validators.clear();
    this.entityTypes.clear();
    return counts;
  }
}

const CANONICAL = Object.freeze({
  application: {
    chrome: 'Google Chrome',
    msedge: 'Microsoft Edge',
    edge: 'Microsoft Edge',
    firefox: 'Mozilla Firefox',
    vscode: 'Visual Studio Code',
    'vs code': 'Visual Studio Code',
    notepad: 'Notepad',
    calc: 'Calculator',
    calculator: 'Calculator',
    instagram: 'Instagram',
    telegram: 'Telegram',
    spotify: 'Spotify',
    youtube: 'YouTube'
  },
  browser: {
    chrome: 'Google Chrome',
    edge: 'Microsoft Edge',
    msedge: 'Microsoft Edge',
    firefox: 'Mozilla Firefox'
  },
  website: {
    yt: 'YouTube',
    youtube: 'YouTube',
    github: 'GitHub',
    google: 'Google',
    gmail: 'Gmail'
  },
  folder: {
    docs: 'Documents',
    documents: 'Documents',
    desktop: 'Desktop Folder',
    downloads: 'Downloads',
    pictures: 'Pictures',
    videos: 'Videos',
    music: 'Music'
  },
  device: {
    mobile: 'Phone',
    cellphone: 'Phone',
    smartphone: 'Phone',
    iphone: 'iPhone',
    android: 'Android Phone',
    pc: 'Computer'
  },
  network: {
    wifi: 'Wi-Fi',
    'wi-fi': 'Wi-Fi'
  }
});

const NUMBER_WORDS = Object.freeze({
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  sixty: 60
});

class EntityNormalizer {
  constructor(options = {}) {
    this.id = options.id || 'entity.normalizer';
    this.priority = Number.isFinite(options.priority) ? options.priority : 1000;
    this.maps = { ...CANONICAL, ...(options.maps || {}) };
  }

  process(context) {
    for (const entity of context.allEntities()) {
      const key = String(entity.value || '').toLowerCase().trim();
      const rawKey = String(entity.rawValue || '').toLowerCase().trim();
      const repairedKey = repairKnownTokenText(key);
      const repairedRawKey = repairKnownTokenText(rawKey);
      entity.canonical = this.maps[entity.type]?.[key] ||
        this.maps[entity.type]?.[rawKey] ||
        this.maps[entity.type]?.[repairedKey] ||
        this.maps[entity.type]?.[repairedRawKey] ||
        entity.canonical ||
        entity.value;
      if (entity.type === 'duration') entity.metadata.durationSeconds = this._durationSeconds(entity.value);
      if (entity.type === 'volumeLevel' || entity.type === 'brightnessLevel') {
        entity.value = String(Math.max(0, Math.min(100, Number(entity.value) || 0)));
        entity.canonical = entity.value;
      }
    }
    return context;
  }

  _durationSeconds(value) {
    const match = String(value || '').toLowerCase().match(/\b(\d+|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|sixty)\s*(seconds?|secs?|minutes?|mins?|minits?|hours?|hrs?)\b/);
    if (!match) return null;
    const amount = Number.isFinite(Number(match[1])) ? Number(match[1]) : NUMBER_WORDS[match[1]];
    if (!Number.isFinite(amount)) return null;
    if (/hour|hr/.test(match[2])) return amount * 3600;
    if (/min/.test(match[2])) return amount * 60;
    return amount;
  }
}

const KNOWN_FOLDERS = Object.freeze({
  desktop: 'desktop',
  downloads: 'downloads',
  documents: 'documents',
  pictures: 'pictures',
  music: 'music',
  videos: 'videos',
  home: 'home'
});

function normalizeList(values) {
  return new Set((Array.isArray(values) ? values : []).map(value => String(value || '').toLowerCase().trim()).filter(Boolean));
}

class EntityResolver {
  constructor(options = {}) {
    this.id = options.id || 'entity.resolver';
    this.priority = Number.isFinite(options.priority) ? options.priority : 1010;
    this.providers = { ...(options.providers || {}) };
    this.installedApplications = normalizeList(this.providers.installedApplications || this.providers.applications);
    this.knownBrowsers = normalizeList(this.providers.browsers || ['Google Chrome', 'Microsoft Edge', 'Mozilla Firefox']);
  }

  process(context) {
    for (const folder of context.entities.folders) {
      const key = String(folder.value || folder.canonical || '').toLowerCase().replace(/\s+folder$/, '');
      if (KNOWN_FOLDERS[key]) {
        folder.resolved = { kind: 'known-system-folder', location: KNOWN_FOLDERS[key] };
      }
    }

    for (const app of context.entities.applications) {
      const name = app.canonical || app.value;
      const key = String(name).toLowerCase();
      app.resolved = app.resolved || {
        kind: this.installedApplications.size === 0 || this.installedApplications.has(key)
          ? 'installed-application'
          : 'application-name',
        name
      };
    }

    for (const browser of context.entities.browsers) {
      const name = browser.canonical || browser.value;
      browser.resolved = browser.resolved || {
        kind: this.knownBrowsers.has(String(name).toLowerCase()) ? 'known-browser' : 'browser-reference',
        name
      };
    }

    for (const website of context.entities.websites) {
      const value = website.canonical || website.value;
      website.resolved = website.resolved || {
        kind: /^https?:\/\//i.test(value) || /\.[a-z]{2,}/i.test(value) ? 'url' : 'known-website',
        value,
        url: /^https?:\/\//i.test(value)
          ? value
          : /\.[a-z]{2,}/i.test(value)
            ? `https://${value.replace(/^www\./i, '')}`
            : null
      };
    }

    for (const contact of context.entities.contacts) {
      contact.resolved = contact.resolved || { kind: 'contact-reference', name: contact.canonical || contact.value };
    }

    for (const file of context.entities.files) {
      file.resolved = file.resolved || { kind: /\.[A-Za-z0-9]{1,10}$/.test(file.value) ? 'file-name' : 'file-reference', name: file.value };
    }

    for (const pathEntity of context.entities.paths) {
      pathEntity.resolved = pathEntity.resolved || { kind: 'path-reference', path: pathEntity.value };
    }

    for (const entity of [
      ...context.entities.dates,
      ...context.entities.times,
      ...context.entities.durations,
      ...context.entities.reminders,
      ...context.entities.alarms,
      ...context.entities.timers
    ]) {
      entity.resolved = entity.resolved || { kind: `${entity.type}-reference`, value: entity.canonical || entity.value };
    }

    return context;
  }
}

const RELATIVE_DATES = /^(?:today|tomorrow|tonight|next\s+(?:week|month)|(?:next\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))$/i;
const NATURAL_DATES = /^(?:(?:this|next)\s+month\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}(?:st|nd|rd|th)?(?:\s+(?:of\s+)?(?:this|next)\s+month|\s+(?:this|next)\s+month)|\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+(?:\d{2,4}|(?:of\s+)?(?:this|next)\s+year))?|\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:,?\s+(?:\d{2,4}|(?:of\s+)?(?:this|next)\s+year))?)$/i;

class EntityValidator {
  constructor(options = {}) {
    this.id = options.id || 'entity.validator';
    this.priority = Number.isFinite(options.priority) ? options.priority : 1020;
    this.providers = { ...(options.providers || {}) };
    this.knownApplications = normalizeList(this.providers.installedApplications || this.providers.applications);
    this.knownBrowsers = normalizeList(this.providers.browsers || ['Google Chrome', 'Microsoft Edge', 'Mozilla Firefox']);
  }

  process(context) {
    const seen = new Set();
    const status = { valid: true, entityCount: 0, issueCount: 0 };
    for (const entity of context.allEntities()) {
      const key = `${entity.type}:${String(entity.canonical || entity.value).toLowerCase()}`;
      const issues = [];
      if (!entity.value) issues.push('missing-value');
      if (seen.has(key)) {
        issues.push('duplicate-entity');
        context.diagnostics.duplicateEntities.push({ type: entity.type, value: entity.value });
      }
      seen.add(key);
      if (entity.type === 'path' && !/^[A-Za-z]:\\|^\\\\|^~|^\//.test(entity.value)) {
        issues.push('unverified-path');
      }
      if (entity.type === 'date' && entity.metadata?.recurring !== true && !RELATIVE_DATES.test(entity.value) && !NATURAL_DATES.test(entity.value) && Number.isNaN(Date.parse(entity.value))) {
        issues.push('invalid-date');
      }
      if ((entity.type === 'volumeLevel' || entity.type === 'brightnessLevel') && (Number(entity.value) < 0 || Number(entity.value) > 100)) {
        issues.push('numeric-range');
      }
      if ((entity.type === 'reminder' || entity.type === 'media' || entity.type === 'contact') && String(entity.value).trim().length < 2) {
        issues.push('too-short');
      }
      if (entity.confidence < 0.45) {
        issues.push('low-confidence');
      }
      if (entity.type === 'application' && this.knownApplications.size > 0 && !this.knownApplications.has(String(entity.canonical || entity.value).toLowerCase())) {
        issues.push('unknown-application');
        context.diagnostics.unknownEntities.push({ type: entity.type, value: entity.value });
      }
      if (entity.type === 'browser' && !this.knownBrowsers.has(String(entity.canonical || entity.value).toLowerCase())) {
        issues.push('unknown-browser');
        context.diagnostics.unknownEntities.push({ type: entity.type, value: entity.value });
      }
      entity.validation = {
        valid: issues.length === 0,
        issues
      };
      status.entityCount += 1;
      status.issueCount += issues.length;
      if (issues.length > 0) status.valid = false;
    }
    context.diagnostics.validation = status;
    return context;
  }
}

const ACTION_CONCEPTS = new Set([
  'OPEN', 'START', 'CLOSE', 'SEARCH', 'CREATE', 'DELETE', 'MOVE', 'COPY', 'SEND',
  'REMIND', 'ALARM', 'TIMER', 'PLAY', 'SET', 'ENABLE', 'DISABLE', 'INCREASE', 'REDUCE'
]);

class EntityRelationshipBuilder {
  constructor(options = {}) {
    this.id = options.id || 'entity.relationshipBuilder';
    this.priority = Number.isFinite(options.priority) ? options.priority : 1030;
  }

  process(context) {
    const concepts = Array.isArray(context.semanticRepresentation?.concepts)
      ? context.semanticRepresentation.concepts
      : [];
    const actions = concepts.filter(concept => ACTION_CONCEPTS.has(concept.concept));

    for (const action of actions) {
      for (const entity of context.allEntities()) {
        context.addRelationship({
          type: 'mentions',
          source: { kind: 'concept', id: action.id || null, value: action.concept },
          target: { kind: 'entity', id: entity.id, entityType: entity.type, value: entity.canonical || entity.value },
          confidence: Math.min(action.confidence || 0.6, entity.confidence || 0.6)
        });
      }
    }

    this._relateFirst(context, 'reminder', ['date', 'time', 'duration']);
    this._relateFirst(context, 'alarm', ['date', 'time']);
    this._relateFirst(context, 'timer', ['duration']);
    this._relateFirst(context, 'file', ['folder', 'path']);
    this._relateFirst(context, 'media', ['website', 'browser']);
    this._relateFirst(context, 'contact', ['person', 'website']);
    this._dedupeRelationships(context);
    return context;
  }

  _relateFirst(context, sourceType, targetTypes) {
    const sources = context.allEntities().filter(entity => entity.type === sourceType);
    if (sources.length === 0) return;
    for (const targetType of targetTypes) {
      const targets = context.allEntities().filter(entity => entity.type === targetType);
      for (const source of sources) {
        for (const target of targets) {
          if (source.id === target.id) continue;
        context.addRelationship({
          type: `${sourceType}-${targetType}`,
          source: { kind: 'entity', id: source.id, entityType: source.type, value: source.canonical || source.value },
          target: { kind: 'entity', id: target.id, entityType: target.type, value: target.canonical || target.value },
          confidence: Math.min(source.confidence || 0.6, target.confidence || 0.6)
        });
        }
      }
    }
  }

  _dedupeRelationships(context) {
    const seen = new Set();
    context.relationships = context.relationships.filter(relationship => {
      const key = `${relationship.type}:${relationship.source?.id || relationship.source?.value}:${relationship.target?.id || relationship.target?.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

class EntityGraphBuilder {
  constructor(options = {}) {
    this.id = options.id || 'entity.graphBuilder';
    this.priority = Number.isFinite(options.priority) ? options.priority : 1040;
  }

  process(context) {
    try {
      context.entityGraph = deepFreeze({
        nodes: context.allEntities().map(entity => ({
          id: entity.id,
          type: entity.type,
          value: entity.canonical || entity.value,
          rawValue: entity.rawValue,
          confidence: entity.confidence,
          resolved: entity.resolved || null,
          validation: entity.validation || null,
          position: {
            index: Number.isFinite(entity.metadata?.index) ? entity.metadata.index : null,
            length: Number.isFinite(entity.metadata?.length) ? entity.metadata.length : null
          },
          metadata: { ...(entity.metadata || {}) }
        })),
        relationships: context.relationships.map((relationship, index) => ({
          id: `relationship:${index + 1}`,
          ...relationship
        }))
      });
      return context;
    } catch (error) {
      throw new EntityGraphError('Failed to build immutable EntityGraph.', { cause: error });
    }
  }
}

class BaseEntityExtractor {
  constructor(options = {}) {
    this.id = String(options.id || this.constructor.name);
    this.name = String(options.name || this.id);
    this.priority = Number.isFinite(options.priority) ? Number(options.priority) : 100;
    this.enabled = options.enabled !== false;
    this.version = String(options.version || '1.0.0');
    this.options = { ...(options || {}) };
    this.initialized = false;
  }

  initialize() {
    this.initialized = true;
    return true;
  }

  supports(context) {
    return this.enabled && !!context;
  }

  extract(context) {
    return context;
  }

  validate(context) {
    return !!context;
  }

  cleanup() {
    return true;
  }

  destroy() {
    this.initialized = false;
    return true;
  }

  text(context) {
    return String(context?.text || context?.normalizedInput || '');
  }

  normalized(context) {
    return Normalizer.normalizeText(this.text(context));
  }

  escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  cleanValue(value) {
    return String(value || '')
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  sourceMetadata(match, source, options = {}) {
    const value = match?.[options.group || 1] || match?.[0] || '';
    return {
      ...(options.metadata || {}),
      index: Number.isFinite(match?.index) ? match.index : null,
      length: String(match?.[0] || value).length,
      extractor: this.id,
      normalizedSource: options.normalized === true,
      sourceText: options.includeSourceText === true ? source : undefined
    };
  }

  addEntity(context, type, value, options = {}) {
    const cleaned = this.cleanValue(value);
    if (!cleaned) return null;
    const confidence = options.confidence ?? 0.7;
    const threshold = Number(this.options.confidenceThreshold ?? context?.configuration?.confidenceThreshold ?? 0);
    if (confidence < threshold) return null;
    return context.addEntity(type, cleaned, {
      rawValue: options.rawValue || value,
      canonical: options.canonical,
      source: this.id,
      confidence,
      metadata: { ...(options.metadata || {}) }
    });
  }

  addAliasMatches(context, type, aliases = {}, options = {}) {
    const source = options.normalized === false ? this.text(context) : this.normalized(context);
    for (const [alias, canonical] of Object.entries(aliases || {})) {
      const pattern = new RegExp(`\\b${this.escapeRegex(alias)}\\b`, 'i');
      const match = source.match(pattern);
      if (match) {
        this.addEntity(context, type, canonical, {
          rawValue: alias,
          canonical,
          confidence: options.confidence ?? 0.82,
          metadata: {
            alias,
            ...this.sourceMetadata(match, source, options),
            ...(options.metadata || {})
          }
        });
      }
    }
    return context;
  }

  addRegexMatches(context, type, regex, options = {}) {
    const source = options.normalized === true ? this.normalized(context) : this.text(context);
    let match;
    const pattern = regex.global ? regex : new RegExp(regex.source, `${regex.flags || ''}g`);
    pattern.lastIndex = 0;
    while ((match = pattern.exec(source))) {
      const value = match[options.group || 1] || match[0];
      const confidence = options.confidence ?? 0.7;
      const threshold = Number(this.options.confidenceThreshold ?? context?.configuration?.confidenceThreshold ?? 0);
      const zeroLength = match[0] === '';
      if (confidence < threshold) {
        if (zeroLength) pattern.lastIndex += 1;
        continue;
      }
      this.addEntity(context, type, value, {
        rawValue: value,
        confidence,
        metadata: this.sourceMetadata(match, source, options)
      });
      if (zeroLength) pattern.lastIndex += 1;
    }
    return context;
  }
}

const SELF_CANONICAL = 'user';

const SELF_ALIASES = Object.freeze([
  'me',
  'myself',
  'i',
  'mine',
  'my face',
  'self',
  'user',
  'owner'
]);

const RELATIONSHIP_ALIASES = Object.freeze({
  father: ['father', 'dad', 'daddy', 'papa', 'appa', 'baba', 'pitaji'],
  mother: ['mother', 'mom', 'mommy', 'mummy', 'mumma', 'mama', 'amma', 'maa', 'ma'],
  parents: ['parents', 'parent'],
  brother: ['brother', 'bro', 'anna', 'bhai'],
  sister: ['sister', 'sis', 'akka', 'didi'],
  grandfather: ['grandfather', 'grandpa', 'thatha', 'nana', 'dada'],
  grandmother: ['grandmother', 'grandma', 'paati', 'nani', 'dadi'],
  uncle: ['uncle', 'mama uncle', 'chacha', 'kaka'],
  aunt: ['aunt', 'aunty', 'auntie', 'chachi', 'mami'],
  cousin: ['cousin'],
  wife: ['wife'],
  husband: ['husband'],
  child: ['child', 'kid', 'son', 'daughter'],
  children: ['children', 'kids'],
  friend: ['friend', 'best friend', 'buddy'],
  friends: ['friends'],
  colleague: ['colleague', 'coworker', 'co worker', 'teammate'],
  classmate: ['classmate'],
  teacher: ['teacher', 'sir', 'madam', 'maam'],
  boss: ['boss', 'manager'],
  customer: ['customer', 'client'],
  family: ['family', 'family member']
});

const RELATIONSHIP_LOOKUP = Object.freeze(Object.entries(RELATIONSHIP_ALIASES).reduce((lookup, [canonical, aliases]) => {
  lookup[normalizeToken(canonical)] = canonical;
  for (const alias of aliases) lookup[normalizeToken(alias)] = canonical;
  return lookup;
}, {}));

const RELATIONSHIP_TERMS = Object.freeze(Object.keys(RELATIONSHIP_LOOKUP));

const RELATIONSHIP_GROUPS = Object.freeze({
  parents: ['parents', 'father', 'mother'],
  parent: ['parents', 'father', 'mother'],
  children: ['children', 'child'],
  kids: ['children', 'child'],
  friends: ['friends', 'friend'],
  family: [
    'family',
    'father',
    'mother',
    'parents',
    'brother',
    'sister',
    'grandfather',
    'grandmother',
    'uncle',
    'aunt',
    'cousin',
    'wife',
    'husband',
    'child',
    'children'
  ]
});

function normalizeToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isSelfReference(value) {
  const normalized = normalizeToken(value);
  return SELF_ALIASES.some(alias => normalizeToken(alias) === normalized);
}

function normalizePersonReference(value) {
  if (isSelfReference(value)) return SELF_CANONICAL;
  return String(value || '').trim();
}

function normalizeRelationship(value) {
  return RELATIONSHIP_LOOKUP[normalizeToken(value)] || '';
}

function isRelationshipTerm(value) {
  return Boolean(normalizeRelationship(value));
}

function relationshipAliasesFor(value) {
  const canonical = normalizeRelationship(value) || normalizeToken(value);
  return Array.from(new Set([canonical, ...(RELATIONSHIP_ALIASES[canonical] || [])].map(normalizeToken).filter(Boolean)));
}

function allRelationshipTerms() {
  return RELATIONSHIP_TERMS.slice();
}

function findSelfReferences(text) {
  const source = String(text || '');
  const found = [];
  const patterns = [
    /\b(?:of|with|beside|near|around)\s+(me|myself|self)\b/gi,
    /\b(?:me|myself|self)\s+(?:and|with|beside|near|around|at|in|inside|outside)\b/gi,
    /\bi\s+(?:was|am|m|were)?\s*(?:with|beside|near|around|at|in|inside|outside)\b/gi,
    /\b(?:only|just)\s+me\b/gi,
    /\bmy\s+(?:face|selfie|portrait)\b/gi,
    /\bmy\s+(?:photo|photos|picture|pictures|pic|pics|image|images)\s+(?:with|and|of)\b/gi
  ];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source))) {
      found.push({ value: SELF_CANONICAL, raw: match[0], index: match.index });
    }
  }
  return found;
}

function findRelationshipMentions(text) {
  const source = String(text || '');
  const aliases = allRelationshipTerms().sort((left, right) => right.length - left.length);
  const found = [];
  for (const alias of aliases) {
    const pattern = new RegExp(`\\b(?:my\\s+|our\\s+)?${escapeRegex(alias)}\\b`, 'gi');
    let match;
    while ((match = pattern.exec(source))) {
      const canonical = normalizeRelationship(alias);
      if (canonical) found.push({ value: canonical, raw: match[0], alias, index: match.index });
    }
  }
  const seen = new Set();
  return found.filter(item => {
    const key = `${item.value}:${item.index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchesSelfValue(value) {
  return isSelfReference(value) || normalizeToken(value) === SELF_CANONICAL;
}

function personValuesMatch(available, requested) {
  const normalizedRequested = normalizeToken(requested);
  const normalizedAvailable = normalizeToken(available);
  if (!normalizedRequested || !normalizedAvailable) return false;
  if (normalizedRequested === SELF_CANONICAL) return matchesSelfValue(normalizedAvailable);
  return normalizedAvailable === normalizedRequested;
}

function relationshipValuesMatch(available, requested) {
  const requestedCanonical = normalizeRelationship(requested) || normalizeToken(requested);
  const availableCanonical = normalizeRelationship(available) || normalizeToken(available);
  if (!requestedCanonical || !availableCanonical) return false;
  if (requestedCanonical === availableCanonical) return true;
  const requestedGroup = RELATIONSHIP_GROUPS[requestedCanonical] || [requestedCanonical];
  const availableGroup = RELATIONSHIP_GROUPS[availableCanonical] || [availableCanonical];
  return requestedGroup.includes(availableCanonical) || availableGroup.includes(requestedCanonical);
}

function textMentionsPerson(text, requested) {
  const normalized = normalizeToken(text);
  const target = normalizeToken(requested);
  if (!normalized || !target) return false;
  if (target === SELF_CANONICAL) {
    return SELF_ALIASES.some(alias => new RegExp(`\\b${escapeRegex(normalizeToken(alias))}\\b`).test(normalized));
  }
  return new RegExp(`\\b${escapeRegex(target)}\\b`).test(normalized);
}

function textMentionsRelationship(text, requested) {
  const normalized = normalizeToken(text);
  return relationshipAliasesFor(requested).some(alias => new RegExp(`\\b${escapeRegex(alias)}\\b`).test(normalized));
}

async function runProcessor(processor, context) {
  if (typeof processor === 'function') return processor(context);
  if (processor && typeof processor.process === 'function') return processor.process(context);
  if (processor && typeof processor.normalize === 'function') {
    for (const entity of context.allEntities()) processor.normalize(entity, context);
    return context;
  }
  if (processor && typeof processor.resolve === 'function') {
    for (const entity of context.allEntities()) processor.resolve(entity, context);
    return context;
  }
  if (processor && typeof processor.validate === 'function') {
    for (const entity of context.allEntities()) processor.validate(entity, context);
    return context;
  }
  return context;
}

class EntityPipeline {
  constructor(options = {}) {
    this.registry = options.registry || new EntityRegistry();
    this.configuration = options.configuration instanceof EntityConfiguration
      ? options.configuration
      : new EntityConfiguration(options.configuration || {});
    this.logger = options.logger || null;
    this.steps = options.steps || [
      new EntityNormalizer({ ...(options.normalizer || {}), maps: this.configuration.dictionaries }),
      new EntityResolver({ ...(options.resolver || {}), providers: this.configuration.providers }),
      new EntityValidator({ ...(options.validator || {}), providers: this.configuration.providers }),
      new EntityRelationshipBuilder(options.relationshipBuilder || {}),
      new EntityGraphBuilder(options.graphBuilder || {})
    ];
  }

  async _runRegistered(kind, context) {
    const processors = [...(this.registry[kind]?.entries?.() || [])];
    for (const [id, processor] of processors) {
      const started = Date.now();
      context.diagnostics.pipelineOrder.push(id);
      try {
        await runProcessor(processor, context);
      } catch (error) {
        context.diagnostics.error(error, { stepId: id });
        if (this.configuration.strict) throw error;
      } finally {
        context.diagnostics.time(id, Date.now() - started);
      }
    }
  }

  async run(semanticRepresentation, options = {}) {
    const context = semanticRepresentation instanceof EntityContext
      ? semanticRepresentation
      : new EntityContext({
          semanticRepresentation,
          configuration: this.configuration,
          registry: this.registry,
          metadata: options.metadata || {}
        });
    if (this.configuration.enabled === false) return context.toStructuredEntities();

    for (const extractor of this.registry.listExtractors({ includeDisabled: false })) {
      const started = Date.now();
      context.diagnostics.pipelineOrder.push(extractor.id);
      try {
        if (!extractor.initialized && typeof extractor.initialize === 'function') await extractor.initialize();
        if (extractor.supports(context)) await extractor.extract(context);
        if (this.configuration.deduplicate !== false) context.compactEntities();
        if (typeof extractor.validate === 'function') extractor.validate(context);
      } catch (error) {
        const wrapped = new ExtractorExecutionError(`Entity extractor failed: ${extractor.id}`, { cause: error, context: { extractorId: extractor.id } });
        context.diagnostics.error(wrapped);
        if (this.configuration.strict) throw wrapped;
      } finally {
        context.diagnostics.time(extractor.id, Date.now() - started);
        if (typeof extractor.cleanup === 'function') await extractor.cleanup(context);
      }
    }

    for (const step of this.steps) {
      context.diagnostics.pipelineOrder.push(step.id);
      const started = Date.now();
      try {
        await step.process(context);
        if (this.configuration.deduplicate !== false) context.compactEntities();
        if (step instanceof EntityNormalizer) await this._runRegistered('normalizers', context);
        if (step instanceof EntityResolver) await this._runRegistered('resolvers', context);
        if (step instanceof EntityValidator) await this._runRegistered('validators', context);
        if (this.configuration.deduplicate !== false) context.compactEntities();
      } catch (error) {
        context.diagnostics.error(error, { stepId: step.id });
        if (this.configuration.strict) throw error;
      } finally {
        context.diagnostics.time(step.id, Date.now() - started);
      }
    }

    return context.toStructuredEntities();
  }
}

module.exports = {
  EntityError,
  EntityExtractionError,
  EntityResolutionError,
  EntityValidationError,
  EntityGraphError,
  ConfigurationError,
  ExtractorExecutionError,
  EntityConfiguration,
  EntityDiagnostics,
  EntityLogger,
  StructuredEntities,
  EntityContext,
  EntityRegistry,
  EntityNormalizer,
  EntityResolver,
  EntityValidator,
  EntityRelationshipBuilder,
  EntityGraphBuilder,
  EntityPipeline,
  BaseEntityExtractor,
  SELF_CANONICAL,
  SELF_ALIASES,
  RELATIONSHIP_ALIASES,
  allRelationshipTerms,
  findRelationshipMentions,
  findSelfReferences,
  isRelationshipTerm,
  isSelfReference,
  matchesSelfValue,
  normalizePersonReference,
  normalizeRelationship,
  normalizeToken,
  personValuesMatch,
  relationshipAliasesFor,
  relationshipValuesMatch,
  textMentionsPerson,
  textMentionsRelationship
};