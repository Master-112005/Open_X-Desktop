'use strict';

class ModelRegistry {
  constructor({ events = null } = {}) {
    this.events = events;
    this.models = new Map();
  }

  register(model = {}) {
    if (!model.id) throw new Error('Model id is required');
    const record = {
      id: String(model.id),
      name: model.name || model.id,
      version: String(model.version || 'unknown'),
      runtime: model.runtime || 'onnx',
      modelPath: model.modelPath || '',
      capabilities: Array.isArray(model.capabilities) ? model.capabilities.slice() : [],
      inputShape: Array.isArray(model.inputShape) ? model.inputShape.slice() : [],
      outputShape: Array.isArray(model.outputShape) ? model.outputShape.slice() : [],
      lazy: model.lazy !== false,
      metadata: { ...(model.metadata || {}) }
    };
    this.models.set(record.id, record);
    this.events?.emit?.('vision.model.registered', { modelId: record.id, version: record.version });
    return record;
  }

  registerMany(models = {}) {
    for (const model of Object.values(models || {})) this.register(model);
    return this;
  }

  get(modelId) {
    return this.models.get(String(modelId || '')) || null;
  }

  has(modelId) {
    return this.models.has(String(modelId || ''));
  }

  list() {
    return Array.from(this.models.values()).map(model => ({ ...model, capabilities: model.capabilities.slice() }));
  }

  findByCapability(capability) {
    return this.list().filter(model => model.capabilities.includes(capability));
  }
}

module.exports = ModelRegistry;
