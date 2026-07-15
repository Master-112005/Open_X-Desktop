'use strict';

const PipelineStage = require('../../../../pipeline/PipelineStage');
const StageResult = require('../../../../pipeline/StageResult');
const VisualQueryEngine = require('./VisualQueryEngine');

class VisualQueryUnderstandingStage extends PipelineStage {
  constructor(options = {}) {
    super({
      id: options.id || 'assistant.visualQuery.understanding',
      name: options.name || 'Assistant Visual Query Understanding',
      order: Number.isFinite(options.order) ? options.order : -3,
      enabled: options.enabled !== false
    });
    this.engine = options.engine || new VisualQueryEngine({
      logger: options.logger || null,
      validation: options.configuration?.validation || options.validation || {}
    });
  }

  async execute(context) {
    if (!context.resolvedContext) {
      return StageResult.skipped(this.id, 'No ResolvedContext available.');
    }

    const visualQuery = this.engine.understand({ pipelineContext: context });
    if (!visualQuery.active) {
      context.set('assistant.visualQuery.active', false);
      return StageResult.skipped(this.id, 'No visual memory request detected.');
    }

    context.visualQuery = visualQuery;
    context.set('assistant.visualQuery', visualQuery);
    context.set('assistant.visualQuery.active', true);
    context.addDiagnostic({
      level: visualQuery.validation.valid ? 'info' : 'warn',
      message: 'Visual Query Understanding completed.',
      code: 'visual-query.understood',
      data: {
        intent: visualQuery.intent,
        confidence: visualQuery.confidence,
        needsClarification: visualQuery.needsClarification
      }
    });

    return StageResult.ok(this.id, {
      active: true,
      intent: visualQuery.intent,
      media: visualQuery.media,
      owner: visualQuery.owner,
      confidence: visualQuery.confidence,
      needsClarification: visualQuery.needsClarification,
      constraintCounts: Object.fromEntries(
        Object.entries(visualQuery.constraints).map(([key, list]) => [key, Array.isArray(list) ? list.length : 0])
      ),
      validation: visualQuery.validation,
      version: visualQuery.version
    });
  }
}

module.exports = VisualQueryUnderstandingStage;
