'use strict';

const { CAPABILITIES, MODEL_IDS } = require('../contracts/VisionContracts');

const TASK_MODELS = Object.freeze({
  embedding: MODEL_IDS.MOBILE_CLIP,
  similarity: MODEL_IDS.MOBILE_CLIP,
  scene: MODEL_IDS.MOBILE_CLIP,
  objects: MODEL_IDS.MOBILE_CLIP,
  faces: MODEL_IDS.SCRFD,
  faceEmbedding: MODEL_IDS.MOBILE_FACE_NET,
  ocr: MODEL_IDS.PADDLE_OCR
});

class InferenceCoordinator {
  constructor({ modelManager, preprocessor, postprocessor, diagnostics = null } = {}) {
    this.modelManager = modelManager;
    this.preprocessor = preprocessor;
    this.postprocessor = postprocessor;
    this.diagnostics = diagnostics;
  }

  async infer(request = {}) {
    const startedAt = Date.now();
    const input = await this.preprocessor.process(request);
    const tasks = this._resolveTasks(input.tasks);
    const rawResults = [];
    const errors = [];
    const warnings = [];
    const modelVersions = {};

    for (const task of tasks) {
      const modelId = TASK_MODELS[task];
      if (!modelId) {
        warnings.push({ task, message: 'No model mapped for task.' });
        continue;
      }
      try {
        const output = await this.modelManager.run(modelId, input, { task, request });
        const model = this.modelManager.registry.get(modelId);
        modelVersions[modelId] = model?.version || 'unknown';
        rawResults.push({ ...output, task, modelId });
      } catch (error) {
        const serialized = { task, modelId, message: error.message, code: error.code || '' };
        warnings.push(serialized);
        this.diagnostics?.warn?.('vision-model-inference-skipped', serialized);
      }
    }

    return this.postprocessor.merge({
      rawResults,
      modelVersions,
      metadata: {
        tasks,
        imagePath: input.imagePath || '',
        runtime: 'vision-engine'
      },
      executionTimeMs: Date.now() - startedAt,
      errors,
      warnings
    });
  }

  _resolveTasks(tasks = []) {
    if (!Array.isArray(tasks) || tasks.length === 0) return ['embedding', 'faces', 'ocr'];
    const aliases = {
      [CAPABILITIES.IMAGE_EMBEDDING]: 'embedding',
      [CAPABILITIES.FACE_DETECTION]: 'faces',
      [CAPABILITIES.FACE_EMBEDDING]: 'faceEmbedding',
      [CAPABILITIES.OCR]: 'ocr'
    };
    return Array.from(new Set(tasks.map(task => aliases[task] || String(task || '').trim()).filter(Boolean)));
  }
}

module.exports = InferenceCoordinator;
