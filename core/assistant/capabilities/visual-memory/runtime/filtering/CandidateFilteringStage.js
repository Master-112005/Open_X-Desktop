'use strict';

const PipelineStage = require('../../../../pipeline/PipelineStage');
const StageResult = require('../../../../pipeline/StageResult');

class CandidateFilteringStage extends PipelineStage {
  constructor(options = {}) {
    super({
      id: options.id || 'assistant.visualCandidate.filtering',
      name: options.name || 'Assistant Visual Candidate Filtering',
      order: Number.isFinite(options.order) ? options.order : -2.5,
      enabled: options.enabled !== false
    });
    this.visualMemoryApi = options.visualMemoryApi || options.api || null;
    this.logger = options.logger || null;
  }

  async execute(context) {
    const visualQuery = context.visualQuery || context.get?.('assistant.visualQuery') || null;
    if (!visualQuery?.active) {
      return StageResult.skipped(this.id, 'No active VisualQuery available.');
    }

    const api = context.options?.visualMemoryApi || context.options?.visualMemory?.api || this.visualMemoryApi;
    if (!api || typeof api.buildCandidatePool !== 'function') {
      context.set('assistant.visualCandidatePool.available', false);
      return StageResult.skipped(this.id, 'Visual Memory API is not connected.');
    }

    const pool = await api.buildCandidatePool(visualQuery, context.options?.visualCandidateFiltering || {});
    context.visualCandidatePool = pool;
    context.set('assistant.visualCandidatePool', pool);
    context.set('assistant.visualCandidatePool.available', true);

    return StageResult.ok(this.id, {
      active: true,
      total: pool?.candidates?.length || 0,
      rejected: pool?.rejectedCount || pool?.rejected?.length || 0,
      stats: typeof pool?.stats === 'function' ? pool.stats() : pool?.stats || null,
      validation: pool?.validation || null
    });
  }
}

module.exports = CandidateFilteringStage;
