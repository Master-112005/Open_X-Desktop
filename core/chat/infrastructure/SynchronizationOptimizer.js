/**
 * Plans bounded Desktop Chat synchronization batches.
 */
class SynchronizationOptimizer {
  /**
   * Creates a synchronization optimizer.
   * @param {object} options Optimizer options.
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus;
    this.defaultBatchSize = Number(options.defaultBatchSize || 50);
    this.maxBatchSize = Number(options.maxBatchSize || 200);
  }

  /**
   * Plans a sync batch size.
   * @param {object} input Sync input.
   * @returns {object} Batch plan.
   */
  planBatch(input = {}) {
    const pending = Math.max(0, Number(input.pending || 0));
    const requested = Number(input.limit || this.defaultBatchSize);
    const limit = Math.min(this.maxBatchSize, Math.max(1, requested), Math.max(1, pending || requested));
    const plan = { pending, limit, shouldRun: pending > 0 };
    this.eventBus?.emit('chat.infrastructure.sync_batch_planned', plan);
    return plan;
  }
}

module.exports = SynchronizationOptimizer;
