'use strict';

const PipelineStage = require('../pipeline/PipelineStage');
const StageResult = require('../pipeline/StageResult');
const { createDefaultPlanningManager } = require('./PlanningManager');

class TaskPlanningStage extends PipelineStage {
  constructor(options = {}) {
    super({
      id: options.id || 'assistant.task.planning',
      name: options.name || 'Assistant Task Planning',
      order: Number.isFinite(options.order) ? options.order : -1,
      enabled: options.enabled !== false
    });
    this.manager = options.manager || createDefaultPlanningManager({
      configuration: options.configuration || {},
      logger: options.logger || null
    });
  }

  async execute(context) {
    if (!context.reasoningResult) {
      return StageResult.skipped(this.id, 'No ReasoningResult available.');
    }
    const executionBlueprint = await this.manager.plan(context.reasoningResult, {
      metadata: {
        ...(context.metadata || {}),
        rawInput: context.rawInput,
        source: context.source
      }
    });
    context.executionBlueprint = executionBlueprint;
    context.set('assistant.executionBlueprint', executionBlueprint);
    return StageResult.ok(this.id, {
      taskCount: executionBlueprint.tasks.length,
      workflow: executionBlueprint.workflow?.type || null,
      dependencyCount: executionBlueprint.dependencies.length,
      version: executionBlueprint.version
    });
  }

  async destroy() {
    if (typeof this.manager?.destroy === 'function') this.manager.destroy();
    return super.destroy();
  }
}

module.exports = TaskPlanningStage;
