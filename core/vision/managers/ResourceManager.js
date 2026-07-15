'use strict';

class ResourceManager {
  constructor({ configuration } = {}) {
    this.configuration = configuration;
    this.running = 0;
  }

  async withSlot(work) {
    const max = this.configuration?.resources?.maxConcurrentInferences || 1;
    if (this.running >= max) {
      const error = new Error('Vision inference concurrency limit reached');
      error.code = 'vision.resource_busy';
      throw error;
    }
    this.running += 1;
    try {
      return await work();
    } finally {
      this.running -= 1;
    }
  }

  getStatus() {
    return {
      running: this.running,
      maxConcurrentInferences: this.configuration?.resources?.maxConcurrentInferences || 1,
      lowMemoryMode: this.configuration?.resources?.lowMemoryMode === true
    };
  }
}

module.exports = ResourceManager;
