'use strict';

class ConfidenceEngine {
  merge(results = []) {
    const values = [];
    for (const result of results) {
      if (Number.isFinite(result?.confidence)) values.push(result.confidence);
      for (const key of ['objects', 'scenes', 'faces', 'ocr', 'embeddings']) {
        const list = Array.isArray(result?.[key]) ? result[key] : [];
        for (const item of list) {
          if (Number.isFinite(item.confidence)) values.push(item.confidence);
        }
      }
    }
    if (values.length === 0) return 0;
    return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4));
  }
}

module.exports = ConfidenceEngine;
