/**
 * Reports Desktop Chat memory pressure and trim guidance.
 */
class MemoryOptimizer {
  /**
   * Creates a memory optimizer.
   * @param {object} options Optimizer options.
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.heapWarningBytes = Number(options.heapWarningBytes || 256 * 1024 * 1024);
  }

  /**
   * Returns memory status.
   * @returns {object} Memory status.
   */
  getStatus() {
    const memory = typeof process !== 'undefined' && typeof process.memoryUsage === 'function'
      ? process.memoryUsage()
      : { heapUsed: 0, rss: 0 };
    const pressure = memory.heapUsed > this.heapWarningBytes;
    if (pressure) this.eventBus?.emit('chat.infrastructure.memory_pressure', { heapUsed: memory.heapUsed });
    return { memory, pressure, heapWarningBytes: this.heapWarningBytes };
  }
}

module.exports = MemoryOptimizer;
