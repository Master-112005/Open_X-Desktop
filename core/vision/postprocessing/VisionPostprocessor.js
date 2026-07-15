'use strict';

const VisionResult = require('../inference/VisionResult');

class VisionPostprocessor {
  constructor({ confidenceEngine, embeddingManager } = {}) {
    this.confidenceEngine = confidenceEngine;
    this.embeddingManager = embeddingManager;
  }

  merge({ rawResults = [], modelVersions = {}, metadata = {}, executionTimeMs = 0, errors = [], warnings = [] } = {}) {
    const normalized = rawResults.map(result => this._normalizeResult(result));
    return new VisionResult({
      success: errors.length === 0,
      objects: normalized.flatMap(result => result.objects),
      scenes: normalized.flatMap(result => result.scenes),
      faces: normalized.flatMap(result => result.faces),
      ocr: normalized.flatMap(result => result.ocr),
      embeddings: normalized.flatMap(result => result.embeddings),
      confidence: this.confidenceEngine.merge(normalized),
      metadata,
      executionTimeMs,
      modelVersions,
      errors,
      warnings
    });
  }

  _normalizeResult(result = {}) {
    const embeddings = Array.isArray(result.embeddings)
      ? result.embeddings.map(item => item.vector ? {
        ...item,
        vector: this.embeddingManager.normalize(item.vector)
      } : item)
      : [];
    return {
      objects: Array.isArray(result.objects) ? result.objects : [],
      scenes: Array.isArray(result.scenes) ? result.scenes : [],
      faces: Array.isArray(result.faces) ? result.faces : [],
      ocr: Array.isArray(result.ocr) ? result.ocr : [],
      embeddings,
      confidence: Number(result.confidence || 0)
    };
  }
}

module.exports = VisionPostprocessor;
