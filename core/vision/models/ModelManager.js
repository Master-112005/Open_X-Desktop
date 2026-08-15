'use strict';

const { MODEL_STATES } = require('../contracts/VisionContracts');

class ModelManager {
  constructor({ registry, runtime, diagnostics = null, events = null, logger = null } = {}) {
    this.registry = registry;
    this.runtime = runtime;
    this.diagnostics = diagnostics;
    this.events = events;
    this.logger = logger;
    this.states = new Map();
    this.cache = new Map();
    this.loggedLoading = new Set();
    this.loggedReady = new Set();
  }

  register(model) {
    const record = this.registry.register(model);
    this.states.set(record.id, MODEL_STATES.REGISTERED);
    return record;
  }

  registerMany(models) {
    for (const model of Object.values(models || {})) this.register(model);
    return this;
  }

  async load(modelId) {
    const id = String(modelId || '');
    const model = this.registry.get(id);
    if (!model) {
      const error = new Error(`Vision model is not registered: ${id}`);
      error.code = 'vision.model_not_registered';
      throw error;
    }
    if (this.cache.has(id)) return this.cache.get(id);
    this.states.set(id, MODEL_STATES.LOADING);
    if (!this.loggedLoading.has(id)) {
      this.loggedLoading.add(id);
      this._info('Loading vision model', this._modelSummary(model, { status: MODEL_STATES.LOADING }));
    }
    try {
      const session = await this.runtime.createSession(model);
      const loaded = { ...model, session, loadedAt: new Date().toISOString() };
      this.cache.set(id, loaded);
      this.states.set(id, MODEL_STATES.READY);
      if (!this.loggedReady.has(id)) {
        this.loggedReady.add(id);
        this._info('Vision model ready', this._modelSummary(model, { status: MODEL_STATES.READY }));
      }
      this.diagnostics?.record?.('model-loaded', { modelId: id, version: model.version });
      this.events?.emit?.('vision.model.loaded', { modelId: id, version: model.version });
      return loaded;
    } catch (error) {
      this.states.set(id, MODEL_STATES.ERROR);
      this._warn('Vision model could not be loaded', this._modelSummary(model, {
        status: MODEL_STATES.ERROR,
        error: error.message,
        code: error.code || 'vision.model_load_failed'
      }));
      this.diagnostics?.error?.('model-load-failed', error);
      throw error;
    }
  }

  async unload(modelId) {
    const id = String(modelId || '');
    this.states.set(id, MODEL_STATES.UNLOADING);
    await this.runtime.disposeSession(id);
    this.cache.delete(id);
    this.states.set(id, MODEL_STATES.UNLOADED);
    this.events?.emit?.('vision.model.unloaded', { modelId: id });
    this.diagnostics?.record?.('model-unloaded', { modelId: id });
  }

  async unloadAll() {
    for (const id of Array.from(this.cache.keys())) await this.unload(id);
  }

  async run(modelId, input, options = {}) {
    const loaded = await this.load(modelId);
    return this.runtime.runSession(loaded, input, options);
  }

  getModelState(modelId) {
    return this.states.get(String(modelId || '')) || MODEL_STATES.REGISTERED;
  }

  healthCheck() {
    return {
      registered: this.registry.list().length,
      loaded: this.cache.size,
      states: Object.fromEntries(this.states.entries())
    };
  }

  _modelSummary(model = {}, extra = {}) {
    const capabilities = Array.isArray(model.capabilities) ? model.capabilities : [];
    return {
      modelId: model.id || 'unknown',
      model: model.name || model.id || 'unknown',
      role: this._modelRole(capabilities),
      runtime: model.runtime || 'unknown',
      version: model.version || 'unknown',
      capabilities: capabilities.map(item => this._humanCapability(item)),
      lazy: model.lazy !== false,
      ...extra
    };
  }

  _modelRole(capabilities = []) {
    if (capabilities.includes('face-detection')) return 'face detection';
    if (capabilities.includes('face-embedding')) return 'face recognition embeddings';
    if (capabilities.includes('ocr')) return 'text reading';
    if (capabilities.includes('image-embedding')) return 'photo understanding';
    return 'vision inference';
  }

  _humanCapability(capability = '') {
    return String(capability || '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, letter => letter.toUpperCase());
  }

  _info(message, data = {}) {
    this.logger?.info?.(`[Vision Models] ${message}`, data);
  }

  _warn(message, data = {}) {
    this.logger?.warn?.(`[Vision Models] ${message}`, data);
  }
}

module.exports = ModelManager;
