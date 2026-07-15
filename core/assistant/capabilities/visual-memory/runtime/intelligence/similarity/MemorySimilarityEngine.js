'use strict';

class MemorySimilarityEngine {
  similarity(left = [], right = []) {
    const a = this._normalize(left);
    const b = this._normalize(right);
    const length = Math.min(a.length, b.length);
    if (!length) return 0;
    let dot = 0;
    for (let index = 0; index < length; index += 1) dot += a[index] * b[index];
    return Math.max(-1, Math.min(1, dot));
  }

  score(candidateVision = {}, referenceEmbedding = null) {
    if (!referenceEmbedding) return 0;
    const embeddings = Array.isArray(candidateVision.embeddings) ? candidateVision.embeddings : [];
    return embeddings.reduce((best, item) => Math.max(best, this.similarity(item.vector || [], referenceEmbedding)), 0);
  }

  _normalize(vector = []) {
    const values = Array.isArray(vector) ? vector.map(Number).filter(Number.isFinite) : [];
    const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
    return magnitude ? values.map(value => value / magnitude) : values;
  }
}

module.exports = MemorySimilarityEngine;
