'use strict';

class EmbeddingManager {
  normalize(vector = []) {
    const values = Array.isArray(vector) ? vector.map(Number).filter(Number.isFinite) : [];
    const magnitude = Math.sqrt(values.reduce((sum, value) => sum + (value * value), 0));
    if (!magnitude) return values;
    return values.map(value => value / magnitude);
  }

  similarity(left = [], right = []) {
    const a = this.normalize(left);
    const b = this.normalize(right);
    const length = Math.min(a.length, b.length);
    if (!length) return 0;
    let dot = 0;
    for (let index = 0; index < length; index += 1) dot += a[index] * b[index];
    return Math.max(-1, Math.min(1, dot));
  }

  createEmbeddingRecord({ modelId, vector, metadata = {}, confidence = 0 }) {
    return {
      modelId,
      vector: this.normalize(vector),
      dimensions: Array.isArray(vector) ? vector.length : 0,
      confidence: Math.max(0, Math.min(1, Number(confidence || 0))),
      metadata: { ...(metadata || {}) },
      createdAt: new Date().toISOString()
    };
  }
}

module.exports = EmbeddingManager;
