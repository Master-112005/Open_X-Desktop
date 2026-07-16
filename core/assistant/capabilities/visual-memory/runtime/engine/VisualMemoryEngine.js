'use strict';

const path = require('path');
const SharedData = require('../../../../Data');
const VisualMemoryAPI = require('../api/VisualMemoryAPI');
const VisualMemoryDatabase = require('../database/VisualMemoryDatabase');
const DiagnosticsManager = require('../diagnostics/DiagnosticsManager');
const { VisualMemoryEventBus, VISUAL_MEMORY_EVENTS } = require('../events/VisualMemoryEvents');
const FolderManager = require('../folders/FolderManager');
const GalleryManager = require('../gallery/GalleryManager');
const LifecycleManager = require('../lifecycle/LifecycleManager');
const MetadataManager = require('../metadata/MetadataManager');
const PrivacyManager = require('../privacy/PrivacyManager');
const SettingsManager = require('../settings/SettingsManager');
const ThumbnailManager = require('../thumbnails/ThumbnailManager');
const { DEFAULT_VISUAL_MEMORY_SETTINGS, defaultVisualMemoryDataDir } = require('../utils/constants');
const { ensureDir } = require('../utils/FileSystemUtils');
const VisualMemoryValidator = require('../validation/VisualMemoryValidator');
const { CandidateFilterEngine } = require('../filtering');
const { FaceMemoryEngine } = require('../faces');
const { OpenXGalleryEngine } = require('../gallery');
const { VisualMemoryIntelligenceEngine } = require('../intelligence');
const { VisualMemoryLearningEngine } = require('../learning');

function createEventFacade(eventBus) {
  return {
    VISUAL_MEMORY_EVENTS,
    emit: eventBus.emit.bind(eventBus),
    subscribe: eventBus.subscribe.bind(eventBus)
  };
}

class VisualMemoryEngine {
  constructor(options = {}) {
    this.options = options;
    this.rootDir = options.rootDir || path.resolve(__dirname, '..', '..', '..');
    this.dataDir = options.dataDir || defaultVisualMemoryDataDir();
    this.databasePath = options.databasePath || path.join(this.dataDir, DEFAULT_VISUAL_MEMORY_SETTINGS.storage.dataFile);
    this.thumbnailDir = options.thumbnailDir || path.join(this.dataDir, DEFAULT_VISUAL_MEMORY_SETTINGS.storage.thumbnailDir);
    this.logger = options.logger || new SharedData.Logger(options.logging || { console: false, file: false });
    this.eventBus = options.eventBus || new VisualMemoryEventBus(options.events);
    this.events = createEventFacade(this.eventBus);
    this.validator = options.validator || new VisualMemoryValidator(options.validation);
    this.api = new VisualMemoryAPI({ engine: this });
    this.initialized = false;
    this.starting = null;
    this.faceMemoryPersist = Promise.resolve();
    this.visualMemoryLearningPersist = Promise.resolve();
    this.galleryExperiencePersist = Promise.resolve();
  }

  async initialize() {
    if (this.initialized) return this;
    this.lifecycle = new LifecycleManager({ events: this.events });
    this.lifecycle.transition('initializing', { dataDir: this.dataDir });

    try {
      await ensureDir(this.dataDir);
      await ensureDir(this.thumbnailDir);
      this.database = new VisualMemoryDatabase({ filePath: this.databasePath, logger: this.logger });
      await this.database.open();

      this.diagnostics = new DiagnosticsManager({ database: this.database, logger: this.logger });
      this.lifecycle = new LifecycleManager({ events: this.events, diagnostics: this.diagnostics });
      this.settings = new SettingsManager({ database: this.database, validator: this.validator, events: this.events, logger: this.logger });
      this.folders = new FolderManager({ database: this.database, validator: this.validator, events: this.events, logger: this.logger });
      this.metadata = new MetadataManager({ database: this.database, validator: this.validator, events: this.events, logger: this.logger });
      this.thumbnails = new ThumbnailManager({
        database: this.database,
        settings: this.settings,
        events: this.events,
        thumbnailDir: this.thumbnailDir,
        adapter: this.options.thumbnailAdapter,
        logger: this.logger
      });
      this.gallery = new GalleryManager({
        database: this.database,
        validator: this.validator,
        thumbnails: this.thumbnails,
        settings: this.settings
      });
      this.privacy = new PrivacyManager({ database: this.database, settings: this.settings, events: this.events, logger: this.logger });
      this.candidateFiltering = new CandidateFilterEngine({ logger: this.logger });
      this.intelligence = new VisualMemoryIntelligenceEngine({ logger: this.logger, configuration: this.options.intelligence || {} });
      this.learning = new VisualMemoryLearningEngine({
        logger: this.logger,
        configuration: this.options.learning || this.options.visualMemoryLearning || {},
        state: this._loadVisualMemoryLearningState(),
        assistantLearning: this.options.assistantLearning || this.options.learningManager || null
      });
      this.learning.events.subscribe('*', () => {
        this.persistVisualMemoryLearning().catch(error => {
          this.logger?.warn?.('[VisualMemory] Learning persistence failed', error);
        });
      });
      this.galleryExperience = new OpenXGalleryEngine({
        visualMemoryEngine: this,
        logger: this.logger,
        configuration: this.options.galleryExperience || {},
        stateProvider: () => this._loadGalleryExperienceState(),
        persist: state => this.persistGalleryExperience(state)
      });
      this.faces = new FaceMemoryEngine({
        logger: this.logger,
        configuration: this.options.faces || {},
        state: this._loadFaceMemoryState()
      });
      this.faces.events.subscribe('*', () => {
        this.persistFaceMemory().catch(error => {
          this.logger?.warn?.('[VisualMemory] Face Memory persistence failed', error);
        });
      });
      await this.faces.initialize();
      await this.persistFaceMemory();
      await this.learning.initialize();
      await this.persistVisualMemoryLearning();
      await this.galleryExperience.initialize();
      await this.persistGalleryExperience(this._loadGalleryExperienceState());

      if (this.options.addDefaultFolders) await this.folders.addDefaultFolders();

      this.initialized = true;
      this.lifecycle.transition('ready', { dataDir: this.dataDir, databasePath: this.databasePath });
      await this.diagnostics.record('initialized', this.getStatus());
      this.events.emit(VISUAL_MEMORY_EVENTS.INITIALIZED, this.getStatus());
      return this;
    } catch (error) {
      this.events.emit(VISUAL_MEMORY_EVENTS.ERROR, { phase: 'initialize', message: error.message });
      if (this.database?.opened && this.diagnostics) await this.diagnostics.recordError('initialize-failed', error);
      this.lifecycle?.transition?.('error', { message: error.message });
      throw error;
    }
  }

  async start() {
    if (this.starting) return this.starting;
    if (this.initialized && this.lifecycle?.getState?.().state === 'started') {
      return this.getStatus();
    }
    this.starting = (async () => {
      await this.initialize();
      if (this.lifecycle?.getState?.().state === 'started') {
        return this.getStatus();
      }
      const settings = this.settings.getSettings();
      if (settings.enabled === false) {
        this.lifecycle.transition('paused', { reason: 'disabled' });
        return this.getStatus();
      }
      this.lifecycle.transition('started', { dataDir: this.dataDir });
      await this.diagnostics.record('started', this.getStatus());
      this.events.emit(VISUAL_MEMORY_EVENTS.STARTED, this.getStatus());
      return this.getStatus();
    })();
    try {
      return await this.starting;
    } finally {
      this.starting = null;
    }
  }

  async pause(reason = 'manual') {
    await this.initialize();
    this.lifecycle.transition('paused', { reason });
    await this.diagnostics.record('paused', { reason });
    this.events.emit(VISUAL_MEMORY_EVENTS.PAUSED, { reason });
    return this.getStatus();
  }

  async resume() {
    await this.initialize();
    this.lifecycle.transition('started', { reason: 'resume' });
    await this.diagnostics.record('resumed');
    this.events.emit(VISUAL_MEMORY_EVENTS.RESUMED, this.getStatus());
    return this.getStatus();
  }

  async stop(reason = 'manual') {
    if (!this.initialized) return this.getStatus();
    this.lifecycle.transition('stopped', { reason });
    await this.diagnostics.record('stopped', { reason });
    this.events.emit(VISUAL_MEMORY_EVENTS.STOPPED, { reason });
    return this.getStatus();
  }

  async shutdown() {
    if (!this.initialized) return this.getStatus();
    this.lifecycle.transition('shutdown');
    await this.diagnostics.record('shutdown');
    this.events.emit(VISUAL_MEMORY_EVENTS.SHUTDOWN, this.getStatus());
    await this.database.close();
    this.initialized = false;
    return this.getStatus();
  }

  async restart() {
    await this.stop('restart');
    return this.start();
  }

  ensureReady() {
    if (!this.initialized || !this.database?.opened) {
      throw new Error('Visual Memory is not initialized');
    }
    const settings = this.settings.getSettings();
    if (settings.enabled === false) {
      throw new Error('Visual Memory is disabled');
    }
  }

  getStatus() {
    return {
      initialized: this.initialized,
      lifecycle: this.lifecycle?.getState?.() || { state: 'created', ready: false },
      dataDir: this.dataDir,
      databasePath: this.databasePath,
      thumbnailDir: this.thumbnailDir,
      localOnly: true
    };
  }

  healthCheck() {
    if (!this.initialized || !this.diagnostics) {
      return { status: 'created', initialized: false, localOnly: true };
    }
    return {
      ...this.diagnostics.getHealth(),
      localOnly: true,
      faces: this.faces?.healthCheck?.() || null,
      galleryExperience: this.galleryExperience?.healthCheck?.() || null,
      learning: this.learning?.healthCheck?.() || null
    };
  }

  _loadFaceMemoryState() {
    const stored = this.database.getTable('faceMemory');
    return {
      ...FaceMemoryEngine.createState(),
      ...(stored && typeof stored === 'object' ? stored : {})
    };
  }

  async persistFaceMemory() {
    if (!this.database?.opened || !this.faces?.state) return null;
    const state = JSON.parse(JSON.stringify(this.faces.state));
    this.faceMemoryPersist = this.faceMemoryPersist
      .catch(() => null)
      .then(() => this.database.replaceTable('faceMemory', state));
    return this.faceMemoryPersist;
  }

  _loadGalleryExperienceState() {
    const galleryState = this.database.getTable('galleryState');
    return galleryState?.experience || OpenXGalleryEngine.createExperienceState();
  }

  async persistGalleryExperience(state) {
    if (!this.database?.opened) return null;
    const current = this.database.getTable('galleryState');
    const next = {
      ...current,
      experience: state,
      updatedAt: new Date().toISOString()
    };
    this.galleryExperiencePersist = this.galleryExperiencePersist
      .catch(() => null)
      .then(() => this.database.replaceTable('galleryState', next));
    return this.galleryExperiencePersist;
  }

  _loadVisualMemoryLearningState() {
    const stored = this.database.getTable('visualMemoryLearning');
    return {
      ...VisualMemoryLearningEngine.createLearningState(),
      ...(stored && typeof stored === 'object' ? stored : {})
    };
  }

  async persistVisualMemoryLearning() {
    if (!this.database?.opened || !this.learning?.state) return null;
    const state = JSON.parse(JSON.stringify(this.learning.state));
    this.visualMemoryLearningPersist = this.visualMemoryLearningPersist
      .catch(() => null)
      .then(() => this.database.replaceTable('visualMemoryLearning', state));
    return this.visualMemoryLearningPersist;
  }
}

module.exports = VisualMemoryEngine;
