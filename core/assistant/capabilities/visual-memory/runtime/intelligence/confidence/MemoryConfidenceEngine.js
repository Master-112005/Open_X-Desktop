'use strict';

class MemoryConfidenceEngine {
  combine(parts = {}) {
    const weights = parts.weights || {};
    const entries = Object.entries(parts.scores || {});
    let total = 0;
    let weightTotal = 0;
    for (const [key, value] of entries) {
      const score = Math.max(0, Math.min(1, Number(value || 0)));
      const weight = Math.max(0, Number(weights[key] ?? weights[`${key}Weight`] ?? 1));
      total += score * weight;
      weightTotal += weight;
    }
    return weightTotal ? Number((total / weightTotal).toFixed(4)) : 0;
  }
}

module.exports = MemoryConfidenceEngine;
