'use strict';

const assert = require('assert');
const {
  VisionEngine,
  MODEL_IDS,
  CAPABILITIES,
  VisionEngineContract,
  EmbeddingManager
} = require('../../core/vision');

function createFakeOnnxAdapter() {
  return {
    async createSession(model) {
      return {
        async run(input, options = {}) {
          if (model.id === MODEL_IDS.MOBILE_CLIP) {
            return {
              scenes: [{ label: 'beach', confidence: 0.91 }],
              objects: [{ label: 'person', confidence: 0.88 }],
              embeddings: [{ vector: [1, 2, 3], confidence: 0.94, metadata: { task: options.task } }],
              confidence: 0.9,
              metadata: { imagePath: input.imagePath }
            };
          }
          if (model.id === MODEL_IDS.SCRFD) {
            return {
              faces: [{ box: [0, 0, 10, 10], landmarks: [], confidence: 0.97 }],
              confidence: 0.97
            };
          }
          if (model.id === MODEL_IDS.PADDLE_OCR) {
            return {
              ocr: [{ text: 'OpenX', box: [0, 0, 20, 10], confidence: 0.93, language: 'en' }],
              confidence: 0.93
            };
          }
          if (model.id === MODEL_IDS.MOBILE_FACE_NET) {
            return {
              embeddings: [{ vector: [0.5, 0.5], confidence: 0.89, metadata: { type: 'face' } }],
              confidence: 0.89
            };
          }
          return { confidence: 0 };
        },
        async dispose() {}
      };
    }
  };
}

describe('VisionEngine', () => {
  it('initializes as an independent AI Vision subsystem with registered model contracts', async () => {
    const engine = new VisionEngine({ logger: { debug() {}, info() {}, warn() {}, error() {} } });
    await engine.initialize();

    const status = engine.getStatus();
    assert.strictEqual(status.initialized, true);
    assert.strictEqual(status.registeredModels, 4);
    assert(engine.registry.findByCapability(CAPABILITIES.OCR).some(model => model.id === MODEL_IDS.PADDLE_OCR));
    assert(VisionEngineContract.forbiddenResponsibilities.includes('natural-language-understanding'));

    await engine.shutdown();
  });

  it('loads all model sessions through ModelManager and RuntimeManager', async () => {
    const engine = new VisionEngine();
    engine.registerRuntimeAdapter('onnx', createFakeOnnxAdapter());
    await engine.initialize();

    await engine.loadModel(MODEL_IDS.MOBILE_CLIP);
    await engine.loadModel(MODEL_IDS.SCRFD);

    const health = engine.healthCheck();
    assert.strictEqual(health.models.loaded, 2);
    assert.strictEqual(health.runtime.sessionCount, 2);

    await engine.shutdown();
  });

  it('runs coordinated inference and returns one normalized VisionResult', async () => {
    const engine = new VisionEngine();
    engine.registerRuntimeAdapter('onnx', createFakeOnnxAdapter());

    const result = await engine.infer({
      imagePath: 'C:/Users/rakes/Pictures/sample.jpg',
      tasks: ['embedding', 'faces', 'ocr']
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.scenes[0].label, 'beach');
    assert.strictEqual(result.faces.length, 1);
    assert.strictEqual(result.ocr[0].text, 'OpenX');
    assert(result.embeddings[0].vector.every(Number.isFinite));
    assert(result.confidence > 0.9);
    assert.strictEqual(result.modelVersions[MODEL_IDS.MOBILE_CLIP], 's2');

    await engine.shutdown();
  });

  it('gracefully returns warnings when runtime adapters or model files are unavailable', async () => {
    const engine = new VisionEngine();
    const result = await engine.infer({
      imagePath: 'C:/Users/rakes/Pictures/missing-runtime.jpg',
      tasks: ['embedding', 'ocr']
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.objects.length, 0);
    assert(result.warnings.some(warning => warning.code === 'vision.runtime_unavailable'));

    await engine.shutdown();
  });

  it('validates image input before inference', async () => {
    const engine = new VisionEngine();
    await assert.rejects(
      () => engine.infer({ tasks: ['embedding'] }),
      error => error.code === 'vision.input_missing'
    );
    await engine.shutdown();
  });

  it('normalizes and compares embeddings without storing them', () => {
    const manager = new EmbeddingManager();
    const record = manager.createEmbeddingRecord({ modelId: MODEL_IDS.MOBILE_CLIP, vector: [3, 4], confidence: 0.8 });

    assert.strictEqual(record.dimensions, 2);
    assert(Math.abs(record.vector[0] - 0.6) < 0.0001);
    assert(Math.abs(manager.similarity([1, 0], [1, 0]) - 1) < 0.0001);
  });
});
