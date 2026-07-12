'use strict';

class PipelineMetadata {
  constructor(values = {}) {
    this.values = { ...(values || {}) };
  }

  set(key, value) {
    this.values[String(key)] = value;
    return this;
  }

  get(key, fallback = undefined) {
    return Object.prototype.hasOwnProperty.call(this.values, key) ? this.values[key] : fallback;
  }

  toJSON() {
    return { ...this.values };
  }
}

module.exports = PipelineMetadata;
