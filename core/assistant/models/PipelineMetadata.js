'use strict';

const { sanitizeDetails } = require('../utils/ErrorHelpers');

class PipelineMetadata {
  constructor(values = {}, options = {}) {
    this.maxEntries = Math.max(10, Number(options.maxEntries) || 200);
    this.values = sanitizeDetails(values || {});
  }

  set(key, value) {
    const normalizedKey = String(key);
    if (Object.keys(this.values).length >= this.maxEntries && !Object.prototype.hasOwnProperty.call(this.values, normalizedKey)) {
      const firstKey = Object.keys(this.values).find(item => !item.startsWith('assistant.')) || Object.keys(this.values)[0];
      delete this.values[firstKey];
    }
    this.values[normalizedKey] = sanitizeDetails(value);
    return this;
  }

  get(key, fallback = undefined) {
    const normalizedKey = String(key);
    return Object.prototype.hasOwnProperty.call(this.values, normalizedKey) ? this.values[normalizedKey] : fallback;
  }

  has(key) {
    return Object.prototype.hasOwnProperty.call(this.values, String(key));
  }

  delete(key) {
    return delete this.values[String(key)];
  }

  merge(values = {}) {
    for (const [key, value] of Object.entries(values || {})) this.set(key, value);
    return this;
  }

  toJSON() {
    return { ...this.values };
  }
}

module.exports = PipelineMetadata;
