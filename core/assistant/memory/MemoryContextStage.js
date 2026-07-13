'use strict';

const PipelineStage = require('../pipeline/PipelineStage');
const StageResult = require('../pipeline/StageResult');
const { createDefaultMemoryManager } = require('./MemoryManager');

class MemoryContextStage extends PipelineStage {
  constructor(options = {}) {
    super({
      id: options.id || 'assistant.memory.context',
      name: options.name || 'Assistant Memory and Context',
      order: Number.isFinite(options.order) ? options.order : -5,
      enabled: options.enabled !== false
    });
    this.manager = options.manager || createDefaultMemoryManager({
      configuration: options.configuration || {},
      logger: options.logger || null
    });
  }

  async execute(context) {
    if (!context.structuredEntities) {
      return StageResult.skipped(this.id, 'No StructuredEntities available.');
    }
    const resolvedContext = await this.manager.resolve(context.structuredEntities, {
      metadata: {
        ...(context.metadata || {}),
        rawInput: context.rawInput,
        source: context.source
      },
      snapshots: context.options?.contextSnapshots || context.metadata?.contextSnapshots || {}
    });
    context.resolvedContext = resolvedContext;
    context.set('assistant.resolvedContext', resolvedContext);
    context.set('assistant.memoryConfidence', resolvedContext.confidence);
    context.set('assistant.memoryTopic', resolvedContext.topic);
    return StageResult.ok(this.id, {
      referenceCount: resolvedContext.resolvedReferences.length,
      aliasCount: resolvedContext.resolvedAliases.length,
      pronounCount: resolvedContext.resolvedPronouns.length,
      dialogueTurns: resolvedContext.dialogueHistory.length,
      hasContext: resolvedContext.hasContext(),
      topic: resolvedContext.topic?.label || null,
      confidence: resolvedContext.confidence,
      version: resolvedContext.version
    });
  }

  async destroy() {
    if (typeof this.manager?.destroy === 'function') await this.manager.destroy();
    return super.destroy();
  }
}

module.exports = MemoryContextStage;
