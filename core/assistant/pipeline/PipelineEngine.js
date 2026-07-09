'use strict';

const PipelineContext = require('./PipelineContext');
const PipelineResult = require('./PipelineResult');
const StageResult = require('./StageResult');
const PipelineConfiguration = require('./PipelineConfiguration');
const PipelineDiagnostics = require('./PipelineDiagnostics');
const PipelineLogger = require('./PipelineLogger');
const PipelineEvents = require('./PipelineEvents');
const PipelineEventDispatcher = require('../events/PipelineEventDispatcher');
const Stopwatch = require('../utils/Stopwatch');
const { withTimeout } = require('../utils/AsyncHelpers');
const { normalizeError } = require('../utils/ErrorHelpers');
const { CancellationError, StageExecutionError, TimeoutError } = require('./PipelineError');

class PipelineEngine {
  constructor({ registry, configuration = {}, diagnostics = null, dispatcher = null, logger = null } = {}) {
    this.registry = registry;
    this.configuration = configuration instanceof PipelineConfiguration
      ? configuration
      : new PipelineConfiguration(configuration);
    this.diagnostics = diagnostics || new PipelineDiagnostics();
    this.dispatcher = dispatcher || new PipelineEventDispatcher();
    this.logger = logger instanceof PipelineLogger ? logger : new PipelineLogger(logger);
    this.running = false;
  }

  async run(input = {}) {
    const context = input instanceof PipelineContext ? input : new PipelineContext(input);
    const stopwatch = new Stopwatch().start();
    const stageResults = [];
    let error = null;
    let output = null;
    this.running = true;
    this.dispatcher.dispatch(PipelineEvents.PIPELINE_STARTED, { requestId: context.requestId, source: context.source });
    try {
      const stages = this.configuration.enabled === false ? [] : this.registry.list({ includeDisabled: false });
      const execution = this._runStages(context, stages, stageResults);
      await withTimeout(execution, this.configuration.timeoutMs, () => new TimeoutError('Assistant Intelligence pipeline timed out.'));
      output = stageResults.length > 0 ? stageResults[stageResults.length - 1].output : {
        input: context.rawInput,
        source: context.source,
        options: { ...(context.options || {}) }
      };
      if (context.cancelled) throw new CancellationError(context.cancelReason || 'Pipeline cancelled.');
      return this._finish(context, stageResults, output, stopwatch, null);
    } catch (err) {
      error = normalizeError(err);
      this.diagnostics.recordError(error, { requestId: context.requestId });
      this.dispatcher.dispatch(
        error instanceof CancellationError ? PipelineEvents.PIPELINE_CANCELLED : PipelineEvents.PIPELINE_ERROR,
        { requestId: context.requestId, error }
      );
      return this._finish(context, stageResults, output, stopwatch, error);
    } finally {
      this.running = false;
    }
  }

  async _runStages(context, stages, stageResults) {
    for (const stage of stages) {
      if (context.cancelled) break;
      const stageWatch = new Stopwatch().start();
      this.dispatcher.dispatch(PipelineEvents.STAGE_STARTED, { requestId: context.requestId, stageId: stage.id });
      try {
        if (!stage.initialized && typeof stage.initialize === 'function') await stage.initialize();
        if (typeof stage.validate === 'function') await stage.validate(context);
        const result = await stage.execute(context);
        const durationMs = stageWatch.stop();
        const stageResult = result instanceof StageResult
          ? new StageResult({ ...result, durationMs: result.durationMs || durationMs })
          : StageResult.ok(stage.id, result, { durationMs });
        context.setStageOutput(stage.id, stageResult.output);
        context.timing.stages.push({ stageId: stage.id, durationMs, success: stageResult.success });
        stageResults.push(stageResult);
        this.diagnostics.recordStage(stage.id, durationMs, { success: stageResult.success });
        this.dispatcher.dispatch(PipelineEvents.STAGE_COMPLETED, { requestId: context.requestId, stageId: stage.id, durationMs });
        if (!stageResult.success && !this.configuration.continueOnStageFailure) break;
      } catch (err) {
        const durationMs = stageWatch.stop();
        const error = err instanceof StageExecutionError ? err : new StageExecutionError(err.message, { stageId: stage.id, cause: err });
        const failed = StageResult.failed(stage.id, error, { durationMs });
        context.timing.stages.push({ stageId: stage.id, durationMs, success: false });
        stageResults.push(failed);
        this.diagnostics.recordError(error, { stageId: stage.id, requestId: context.requestId });
        this.dispatcher.dispatch(PipelineEvents.STAGE_FAILED, { requestId: context.requestId, stageId: stage.id, error });
        if (!this.configuration.continueOnStageFailure) throw error;
      } finally {
        if (typeof stage.cleanup === 'function') await stage.cleanup(context);
      }
    }
  }

  _finish(context, stageResults, output, stopwatch, error) {
    const durationMs = stopwatch.stop();
    context.timing.finishedAt = Date.now();
    context.timing.durationMs = durationMs;
    const result = new PipelineResult({
      success: !error,
      cancelled: error instanceof CancellationError,
      context: context.toJSON(),
      stageResults,
      output,
      diagnostics: context.diagnostics.concat(this.diagnostics.list(25)),
      timing: context.timing,
      error
    });
    this.dispatcher.dispatch(PipelineEvents.PIPELINE_FINISHED, {
      requestId: context.requestId,
      success: result.success,
      durationMs
    });
    return result;
  }
}

module.exports = PipelineEngine;
