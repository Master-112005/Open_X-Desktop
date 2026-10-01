'use strict';

const {
  EntityConfiguration,
  EntityRegistry,
  EntityPipeline
} = require('./EntityCore');
const {
  ApplicationExtractor,
  BrowserExtractor,
  WebsiteExtractor,
  FileExtractor,
  FolderExtractor,
  PathExtractor,
  MediaExtractor,
  ContactExtractor,
  PersonExtractor,
  DeviceExtractor,
  LocationExtractor,
  DateExtractor,
  TimeExtractor,
  DurationExtractor,
  ReminderExtractor,
  AlarmExtractor,
  TimerExtractor,
  WindowExtractor,
  NetworkExtractor,
  VolumeExtractor,
  BrightnessExtractor
} = require('./EntityExtractors');
const PipelineStage = require('../pipeline/PipelineStage');
const StageResult = require('../pipeline/StageResult');

class EntityManager {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof EntityConfiguration
      ? options.configuration
      : new EntityConfiguration(options.configuration || options);
    this.registry = options.registry || new EntityRegistry();
    this.pipeline = options.pipeline || null;
    this.logger = options.logger || null;
    if (options.defaultExtractors !== false) this._registerDefaults();
  }

  _registerDefaults() {
    [
      [ApplicationExtractor, 'entity.applicationExtractor', 10],
      [BrowserExtractor, 'entity.browserExtractor', 20],
      [WebsiteExtractor, 'entity.websiteExtractor', 30],
      [FileExtractor, 'entity.fileExtractor', 40],
      [FolderExtractor, 'entity.folderExtractor', 50],
      [PathExtractor, 'entity.pathExtractor', 60],
      [MediaExtractor, 'entity.mediaExtractor', 70],
      [ContactExtractor, 'entity.contactExtractor', 80],
      [PersonExtractor, 'entity.personExtractor', 90],
      [DeviceExtractor, 'entity.deviceExtractor', 100],
      [LocationExtractor, 'entity.locationExtractor', 110],
      [DateExtractor, 'entity.dateExtractor', 120],
      [TimeExtractor, 'entity.timeExtractor', 130],
      [DurationExtractor, 'entity.durationExtractor', 140],
      [ReminderExtractor, 'entity.reminderExtractor', 150],
      [AlarmExtractor, 'entity.alarmExtractor', 160],
      [TimerExtractor, 'entity.timerExtractor', 170],
      [WindowExtractor, 'entity.windowExtractor', 180],
      [NetworkExtractor, 'entity.networkExtractor', 190],
      [VolumeExtractor, 'entity.volumeExtractor', 200],
      [BrightnessExtractor, 'entity.brightnessExtractor', 210]
    ].forEach(([Ctor, id, priority]) => {
      const configured = this.configuration.getExtractorOptions(id, { priority });
      this.registry.registerExtractor(new Ctor({ id, ...configured }), { id, priority: configured.priority, enabled: configured.enabled });
    });
  }

  registerExtractor(extractor, options = {}) { this.registry.registerExtractor(extractor, options); return this; }
  registerNormalizer(id, normalizer) { this.registry.registerNormalizer(id, normalizer); return this; }
  registerResolver(id, resolver) { this.registry.registerResolver(id, resolver); return this; }
  registerValidator(id, validator) { this.registry.registerValidator(id, validator); return this; }
  registerEntityType(id, definition) {
    const key = String(id || '').trim();
    this.registry.registerEntityType(key, definition);
    if (key) this.configuration.entityTypes[key] = { ...(definition || {}) };
    return this;
  }

  async understand(semanticRepresentation, options = {}) {
    if (!this.pipeline) {
      this.pipeline = new EntityPipeline({
        registry: this.registry,
        configuration: this.configuration,
        logger: this.logger
      });
    }
    return this.pipeline.run(semanticRepresentation, options);
  }

  getStatus() {
    return {
      enabled: this.configuration.enabled,
      version: this.configuration.version,
      pipelineReady: Boolean(this.pipeline),
      extractorCount: this.registry.listExtractors().length,
      normalizerCount: this.registry.normalizers.size,
      resolverCount: this.registry.resolvers.size,
      validatorCount: this.registry.validators.size,
      extractors: this.registry.health()
    };
  }

  destroy() {
    for (const extractor of this.registry.listExtractors()) extractor.destroy?.();
    this.registry.clear();
    this.pipeline = null;
  }
}

function createDefaultEntityManager(options = {}) {
  return new EntityManager(options);
}

class EntityUnderstandingStage extends PipelineStage {
  constructor(options = {}) {
    super({
      id: options.id || 'assistant.entity.understanding',
      name: options.name || 'Assistant Entity Understanding',
      order: Number.isFinite(options.order) ? options.order : -10,
      enabled: options.enabled !== false
    });
    this.manager = options.manager || createDefaultEntityManager({
      configuration: options.configuration || {},
      logger: options.logger || null
    });
  }

  async execute(context) {
    if (!context.semanticRepresentation) {
      return StageResult.skipped(this.id, 'No SemanticRepresentation available.');
    }
    const structuredEntities = await this.manager.understand(context.semanticRepresentation, {
      metadata: context.metadata
    });
    context.structuredEntities = structuredEntities;
    context.set('assistant.structuredEntities', structuredEntities);
    const entityTypes = Object.fromEntries(
      structuredEntities.entityGraph.nodes.reduce((counts, node) => {
        counts.set(node.type, (counts.get(node.type) || 0) + 1);
        return counts;
      }, new Map())
    );
    return StageResult.ok(this.id, {
      entityCount: structuredEntities.entityGraph.nodes.length,
      relationshipCount: structuredEntities.relationships.length,
      entityTypes,
      confidence: structuredEntities.confidence,
      version: structuredEntities.version
    });
  }

  async destroy() {
    if (typeof this.manager?.destroy === 'function') this.manager.destroy();
    return super.destroy();
  }
}

module.exports = { EntityManager, createDefaultEntityManager, EntityUnderstandingStage };