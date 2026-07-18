/**
 * Tracks Desktop Chat local storage collections and recommends cleanup.
 */
class StorageOptimizer {
  /**
   * Creates a storage optimizer.
   * @param {object} options Optimizer options.
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.maxRecords = Number(options.maxRecords || 10000);
    this.collections = new Map();
  }

  /**
   * Records collection size.
   * @param {string} name Collection name.
   * @param {number} count Record count.
   */
  trackCollection(name, count) {
    this.collections.set(name, Number(count) || 0);
    if ((Number(count) || 0) > this.maxRecords) {
      this.eventBus?.emit('chat.infrastructure.storage_pressure', { name, count });
    }
  }

  /**
   * Returns storage status and cleanup recommendations.
   * @returns {object} Storage status.
   */
  getStatus() {
    const collections = Object.fromEntries(this.collections);
    const cleanup = Object.entries(collections)
      .filter(([, count]) => count > this.maxRecords)
      .map(([name, count]) => ({ name, count, action: 'trim_old_records' }));
    return { collections, cleanup, maxRecords: this.maxRecords };
  }
}

module.exports = StorageOptimizer;
