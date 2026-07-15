'use strict';

const { MODEL_IDS, CAPABILITIES } = require('../contracts/VisionContracts');

const DEFAULT_MODELS = Object.freeze({
  [MODEL_IDS.MOBILE_CLIP]: {
    id: MODEL_IDS.MOBILE_CLIP,
    name: 'MobileCLIP-S2',
    version: 's2',
    runtime: 'onnx',
    modelPath: '',
    capabilities: [CAPABILITIES.IMAGE_EMBEDDING, CAPABILITIES.IMAGE_TEXT_SIMILARITY, CAPABILITIES.SCENE_UNDERSTANDING, CAPABILITIES.OBJECT_UNDERSTANDING],
    inputShape: [1, 3, 224, 224],
    outputShape: ['embedding'],
    lazy: true
  },
  [MODEL_IDS.SCRFD]: {
    id: MODEL_IDS.SCRFD,
    name: 'SCRFD',
    version: 'default',
    runtime: 'onnx',
    modelPath: '',
    capabilities: [CAPABILITIES.FACE_DETECTION],
    inputShape: [1, 3, 640, 640],
    outputShape: ['faces'],
    lazy: true
  },
  [MODEL_IDS.MOBILE_FACE_NET]: {
    id: MODEL_IDS.MOBILE_FACE_NET,
    name: 'MobileFaceNet',
    version: 'default',
    runtime: 'onnx',
    modelPath: '',
    capabilities: [CAPABILITIES.FACE_EMBEDDING],
    inputShape: [1, 3, 112, 112],
    outputShape: ['faceEmbedding'],
    lazy: true
  },
  [MODEL_IDS.PADDLE_OCR]: {
    id: MODEL_IDS.PADDLE_OCR,
    name: 'PaddleOCR',
    version: 'default',
    runtime: 'onnx',
    modelPath: '',
    capabilities: [CAPABILITIES.OCR],
    inputShape: ['dynamic'],
    outputShape: ['textRegions'],
    lazy: true
  }
});

class VisionConfiguration {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.runtime = {
      provider: options.runtime?.provider || 'onnx',
      executionProviders: Array.isArray(options.runtime?.executionProviders) ? options.runtime.executionProviders.slice() : ['cpu'],
      threads: Math.max(1, Number(options.runtime?.threads || 2)),
      sessionPoolSize: Math.max(1, Number(options.runtime?.sessionPoolSize || 1))
    };
    this.resources = {
      timeoutMs: Math.max(100, Number(options.resources?.timeoutMs || 15000)),
      maxConcurrentInferences: Math.max(1, Number(options.resources?.maxConcurrentInferences || 1)),
      lowMemoryMode: options.resources?.lowMemoryMode === true,
      maxImageBytes: Math.max(1024, Number(options.resources?.maxImageBytes || 25 * 1024 * 1024))
    };
    this.models = {
      ...DEFAULT_MODELS,
      ...(options.models || {})
    };
    this.preprocessing = {
      targetSize: Number(options.preprocessing?.targetSize || 224),
      preserveAspectRatio: options.preprocessing?.preserveAspectRatio !== false,
      normalize: options.preprocessing?.normalize !== false
    };
    this.diagnostics = {
      maxEvents: Math.max(25, Number(options.diagnostics?.maxEvents || 500))
    };
  }

  toJSON() {
    return {
      enabled: this.enabled,
      runtime: { ...this.runtime, executionProviders: this.runtime.executionProviders.slice() },
      resources: { ...this.resources },
      models: JSON.parse(JSON.stringify(this.models)),
      preprocessing: { ...this.preprocessing },
      diagnostics: { ...this.diagnostics }
    };
  }
}

VisionConfiguration.DEFAULT_MODELS = DEFAULT_MODELS;

module.exports = VisionConfiguration;
