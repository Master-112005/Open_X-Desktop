'use strict';

const VisionConfiguration = require('../configuration/VisionConfiguration');
const { ENGINE_STATES, VISION_ENGINE_VERSION } = require('../contracts/VisionContracts');
const VisionDiagnostics = require('../diagnostics/VisionDiagnostics');
const { VisionEventBus, VISION_EVENTS } = require('../events/VisionEvents');
const VisionLifecycle = require('../lifecycle/VisionLifecycle');
const ModelRegistry = require('../registry/ModelRegistry');
const RuntimeManager = require('../runtime/RuntimeManager');
const ModelManager = require('../models/ModelManager');
const ResourceManager = require('../managers/ResourceManager');
const VisionValidator = require('../validation/VisionValidator');
const ImagePreprocessingPipeline = require('../preprocessing/ImagePreprocessingPipeline');
const ConfidenceEngine = require('../confidence/ConfidenceEngine');
const EmbeddingManager = require('../embeddings/EmbeddingManager');
const VisionPostprocessor = require('../postprocessing/VisionPostprocessor');
const InferenceCoordinator = require('../inference/InferenceCoordinator');

class VisionEngine {
  constructor(options = {}) {
    this.configuration = options.configuration instanceof VisionConfiguration
      ? options.configuration
      : new VisionConfiguration(options.configuration || options);
    this.logger = options.logger || null;
    this.events = options.events || new VisionEventBus(options.eventsOptions || {});
    this.diagnostics = options.diagnostics || new VisionDiagnostics({
      logger: this.logger,
      limit: this.configuration.diagnostics.maxEvents
    });
    this.lifecycle = new VisionLifecycle({ events: this.events, diagnostics: this.diagnostics });
    this.registry = options.registry || new ModelRegistry({ events: this.events });
    this.runtime = options.runtime || new RuntimeManager({ configuration: this.configuration, diagnostics: this.diagnostics, logger: this.logger });
    this.modelManager = options.modelManager || new ModelManager({
      registry: this.registry,
      runtime: this.runtime,
      diagnostics: this.diagnostics,
      events: this.events
    });
    this.resourceManager = options.resourceManager || new ResourceManager({ configuration: this.configuration });
    this.validator = options.validator || new VisionValidator({ configuration: this.configuration });
    this.preprocessor = options.preprocessor || new ImagePreprocessingPipeline({ configuration: this.configuration, validator: this.validator });
    this.confidence = options.confidence || new ConfidenceEngine();
    this.embeddings = options.embeddings || new EmbeddingManager();
    this.postprocessor = options.postprocessor || new VisionPostprocessor({
      confidenceEngine: this.confidence,
      embeddingManager: this.embeddings
    });
    this.inference = options.inference || new InferenceCoordinator({
      modelManager: this.modelManager,
      preprocessor: this.preprocessor,
      postprocessor: this.postprocessor,
      diagnostics: this.diagnostics
    });
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return this;
    this.lifecycle.transition(ENGINE_STATES.INITIALIZING);
    try {
      await this.runtime.initialize();
      this.modelManager.registerMany(this.configuration.models);
      this.initialized = true;
      this.lifecycle.transition(ENGINE_STATES.READY);
      this.events.emit(VISION_EVENTS.INITIALIZED, this.getStatus());
      this.diagnostics.record('vision-initialized', this.getStatus());
      return this;
    } catch (error) {
      this.lifecycle.transition(ENGINE_STATES.ERROR, { error: error.message });
      this.events.emit(VISION_EVENTS.ERROR, { error: error.message });
      this.diagnostics.error('vision-initialize-failed', error);
      throw error;
    }
  }

  registerRuntimeAdapter(runtimeId, adapter) {
    this.runtime.registerAdapter(runtimeId, adapter);
    return this;
  }

  registerModel(model) {
    return this.modelManager.register(model);
  }

  async loadModel(modelId) {
    await this.initialize();
    return this.modelManager.load(modelId);
  }

  async unloadModel(modelId) {
    await this.initialize();
    return this.modelManager.unload(modelId);
  }

  async infer(request = {}) {
    await this.initialize();
    this.lifecycle.transition(ENGINE_STATES.RUNNING);
    this.events.emit(VISION_EVENTS.INFERENCE_STARTED, { tasks: request.tasks || [] });
    try {
      const result = await this.resourceManager.withSlot(() => this.inference.infer(request));
      this.lifecycle.transition(ENGINE_STATES.READY);
      this.events.emit(VISION_EVENTS.INFERENCE_COMPLETED, {
        success: result.success,
        confidence: result.confidence,
        executionTimeMs: result.executionTimeMs
      });
      this.diagnostics.record('vision-inference-completed', {
        confidence: result.confidence,
        executionTimeMs: result.executionTimeMs,
        warnings: result.warnings.length,
        errors: result.errors.length
      });
      return result;
    } catch (error) {
      this.lifecycle.transition(ENGINE_STATES.READY);
      this.events.emit(VISION_EVENTS.INFERENCE_FAILED, { error: error.message });
      this.diagnostics.error('vision-inference-failed', error);
      throw error;
    }
  }

  pause() {
    this.lifecycle.transition(ENGINE_STATES.PAUSED);
    return this.getStatus();
  }

  resume() {
    this.lifecycle.transition(ENGINE_STATES.READY);
    return this.getStatus();
  }

  async shutdown() {
    await this.modelManager.unloadAll();
    await this.runtime.shutdown();
    this.initialized = false;
    this.lifecycle.transition(ENGINE_STATES.SHUTDOWN);
    this.events.emit(VISION_EVENTS.SHUTDOWN, this.getStatus());
    return this.getStatus();
  }

  healthCheck() {
    return {
      version: VISION_ENGINE_VERSION,
      initialized: this.initialized,
      lifecycle: this.lifecycle.getState(),
      runtime: this.runtime.getStatus(),
      models: this.modelManager.healthCheck(),
      resources: this.resourceManager.getStatus(),
      diagnostics: this.diagnostics.summary()
    };
  }

  getStatus() {
    return {
      version: VISION_ENGINE_VERSION,
      initialized: this.initialized,
      lifecycle: this.lifecycle.getState(),
      registeredModels: this.registry.list().length,
      runtime: this.runtime.getStatus(),
      resources: this.resourceManager.getStatus()
    };
  }
}

module.exports = VisionEngine;
