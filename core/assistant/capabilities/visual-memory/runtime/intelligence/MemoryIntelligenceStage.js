'use strict';

const PipelineStage = require('../../../../pipeline/PipelineStage');
const StageResult = require('../../../../pipeline/StageResult');

class MemoryIntelligenceStage extends PipelineStage {
  constructor(options = {}) {
    super({
      id: options.id || 'assistant.visualMemory.intelligence',
      name: options.name || 'Assistant Visual Memory Intelligence',
      order: Number.isFinite(options.order) ? options.order : -2.25,
      enabled: options.enabled !== false
    });
    this.visualMemoryApi = options.visualMemoryApi || options.api || null;
  }

  async execute(context) {
    const visualQuery = context.visualQuery || context.get?.('assistant.visualQuery') || null;
    if (!visualQuery?.active) return StageResult.skipped(this.id, 'No active VisualQuery available.');
    const api = context.options?.visualMemoryApi || context.options?.visualMemory?.api || this.visualMemoryApi;
    if (!api || typeof api.searchMemories !== 'function') {
      context.set('assistant.visualMemoryIntelligence.available', false);
      return StageResult.skipped(this.id, 'Visual Memory Intelligence API is not connected.');
    }
    const candidatePool = context.visualCandidatePool || context.get?.('assistant.visualCandidatePool') || null;
    const result = await api.searchMemories({
      visualQuery,
      candidatePool,
      visionResults: context.options?.visionResults || {},
      pipelineContext: context,
      options: context.options?.visualMemoryIntelligence || {}
    });
    context.visualMemorySearch = result;
    context.set('assistant.visualMemorySearch', result);
    context.set('assistant.visualMemoryIntelligence.available', true);
    return StageResult.ok(this.id, {
      success: result.success,
      total: result.total,
      strategies: result.reasoning?.strategies || [],
      topConfidence: result.results?.[0]?.confidence || 0
    });
  }
}

module.exports = MemoryIntelligenceStage;
