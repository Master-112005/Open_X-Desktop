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
const { CancellationError, StageExecutionError, StageTimeoutError, TimeoutError } = require('./PipelineError');

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
    context.limits.diagnostics = this.configuration.maxDiagnostics;
    context.limits.stageTimings = this.configuration.maxStageTimings;
    context.limits.sharedEntries = this.configuration.maxSharedEntries;
    const stopwatch = new Stopwatch().start();
    const stageResults = [];
    let error = null;
    let output = null;
    this.running = true;
    this.dispatcher.dispatch(PipelineEvents.PIPELINE_STARTED, {
      requestId: context.requestId,
      source: context.source,
      stageCount: this.registry?.count?.() ?? 0
    });
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
      context.addDiagnostic({
        level: 'error',
        message: error.message,
        code: error.code || 'pipeline-error',
        data: { requestId: context.requestId }
      });
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
      if (stage.enabled === false) continue;
      if (typeof stage.supports === 'function' && !stage.supports(context)) {
        const skipped = StageResult.skipped(stage.id, 'Stage does not support this context.');
        stageResults.push(skipped);
        if (typeof stage.markRun === 'function') stage.markRun(skipped);
        continue;
      }
      const stageWatch = new Stopwatch().start();
      const stageOptions = this.configuration.optionsForStage(stage.id);
      this.dispatcher.dispatch(PipelineEvents.STAGE_STARTED, { requestId: context.requestId, stageId: stage.id, order: stage.order });
      try {
        if (!stage.initialized && typeof stage.initialize === 'function') await stage.initialize();
        if (typeof stage.validate === 'function') await stage.validate(context);
        const result = await this._executeStage(stage, context, stageOptions);
        const durationMs = stageWatch.stop();
        const stageResult = result instanceof StageResult
          ? new StageResult({ ...result, metadata: { ...result.metadata, stageOptions }, durationMs: result.durationMs || durationMs })
          : StageResult.ok(stage.id, result, { durationMs, metadata: { stageOptions } });
        if (this.configuration.collectStageOutputs) context.setStageOutput(stage.id, stageResult.output);
        context.addStageTiming(stage.id, durationMs, stageResult.success, { skipped: stageResult.skipped });
        stageResults.push(stageResult);
        if (typeof stage.markRun === 'function') stage.markRun(stageResult);
        this.diagnostics.recordStage(stage.id, durationMs, { success: stageResult.success });
        this.dispatcher.dispatch(PipelineEvents.STAGE_COMPLETED, {
          requestId: context.requestId,
          stageId: stage.id,
          durationMs,
          success: stageResult.success,
          skipped: stageResult.skipped
        });
        if (!stageResult.success && !this.configuration.continueOnStageFailure) break;
      } catch (err) {
        const durationMs = stageWatch.stop();
        const error = err instanceof StageExecutionError || err instanceof StageTimeoutError
          ? err
          : new StageExecutionError(err.message, { stageId: stage.id, requestId: context.requestId, cause: err });
        const failed = StageResult.failed(stage.id, error, { durationMs });
        context.addStageTiming(stage.id, durationMs, false);
        stageResults.push(failed);
        if (typeof stage.markRun === 'function') stage.markRun(failed);
        this.diagnostics.recordError(error, { stageId: stage.id, requestId: context.requestId });
        this.dispatcher.dispatch(PipelineEvents.STAGE_FAILED, { requestId: context.requestId, stageId: stage.id, error });
        if (!this.configuration.continueOnStageFailure) throw error;
      } finally {
        if (typeof stage.cleanup === 'function') await stage.cleanup(context);
      }
    }
  }

  async _executeStage(stage, context, stageOptions = {}) {
    const timeoutMs = Number(stageOptions.timeoutMs ?? this.configuration.stageTimeoutMs);
    return withTimeout(
      Promise.resolve().then(() => stage.execute(context)),
      timeoutMs,
      () => new StageTimeoutError(`Pipeline stage timed out: ${stage.id}`, {
        stageId: stage.id,
        requestId: context.requestId,
        details: { timeoutMs }
      })
    );
  }

  _finish(context, stageResults, output, stopwatch, error) {
    const durationMs = stopwatch.stop();
    context.completeTiming(durationMs);
    const diagnostics = this.configuration.collectDiagnostics
      ? context.diagnostics.concat(this.diagnostics.list(Math.min(25, this.configuration.maxDiagnostics)))
      : [];
    const result = new PipelineResult({
      success: !error,
      cancelled: error instanceof CancellationError,
      context: context.toJSON(),
      stageResults,
      output,
      diagnostics,
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
