'use strict';

const { VISION_ENGINE_VERSION } = require('../contracts/VisionContracts');

class VisionResult {
  constructor(input = {}) {
    this.success = input.success !== false;
    this.objects = Array.isArray(input.objects) ? input.objects.slice() : [];
    this.scenes = Array.isArray(input.scenes) ? input.scenes.slice() : [];
    this.faces = Array.isArray(input.faces) ? input.faces.slice() : [];
    this.ocr = Array.isArray(input.ocr) ? input.ocr.slice() : [];
    this.embeddings = Array.isArray(input.embeddings) ? input.embeddings.slice() : [];
    this.confidence = Math.max(0, Math.min(1, Number(input.confidence || 0)));
    this.metadata = { ...(input.metadata || {}) };
    this.executionTimeMs = Math.max(0, Number(input.executionTimeMs || 0));
    this.modelVersions = { ...(input.modelVersions || {}) };
    this.errors = Array.isArray(input.errors) ? input.errors.slice() : [];
    this.warnings = Array.isArray(input.warnings) ? input.warnings.slice() : [];
    this.version = VISION_ENGINE_VERSION;
  }

  toJSON() {
    return {
      success: this.success,
      objects: this.objects,
      scenes: this.scenes,
      faces: this.faces,
      ocr: this.ocr,
      embeddings: this.embeddings,
      confidence: this.confidence,
      metadata: this.metadata,
      executionTimeMs: this.executionTimeMs,
      modelVersions: this.modelVersions,
      errors: this.errors,
      warnings: this.warnings,
      version: this.version
    };
  }
}

module.exports = VisionResult;
