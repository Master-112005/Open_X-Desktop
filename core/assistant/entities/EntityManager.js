'use strict';

const EntityConfiguration = require('./EntityConfiguration');
const EntityRegistry = require('./EntityRegistry');
const EntityPipeline = require('./EntityPipeline');
const ApplicationExtractor = require('./ApplicationExtractor');
const BrowserExtractor = require('./BrowserExtractor');
const WebsiteExtractor = require('./WebsiteExtractor');
const FileExtractor = require('./FileExtractor');
const FolderExtractor = require('./FolderExtractor');
const PathExtractor = require('./PathExtractor');
const MediaExtractor = require('./MediaExtractor');
const ContactExtractor = require('./ContactExtractor');
const PersonExtractor = require('./PersonExtractor');
const DeviceExtractor = require('./DeviceExtractor');
const LocationExtractor = require('./LocationExtractor');
const DateExtractor = require('./DateExtractor');
const TimeExtractor = require('./TimeExtractor');
const DurationExtractor = require('./DurationExtractor');
const ReminderExtractor = require('./ReminderExtractor');
const AlarmExtractor = require('./AlarmExtractor');
const TimerExtractor = require('./TimerExtractor');
const WindowExtractor = require('./WindowExtractor');
const NetworkExtractor = require('./NetworkExtractor');
const VolumeExtractor = require('./VolumeExtractor');
const BrightnessExtractor = require('./BrightnessExtractor');

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

module.exports = { EntityManager, createDefaultEntityManager };
