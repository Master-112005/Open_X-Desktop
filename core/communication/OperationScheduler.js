'use strict';

const {
  abortController,
  createCancellationError,
  createTimeoutError,
  raceWithSignal,
  throwIfAborted
} = require('../assistant/utils/Cancellation');
const {
  DeadlineExceededError,
  DuplicateStageExecutionError,
  InsufficientRemainingTimeError,
  MissingPreconditionError,
  StageCancelledError
} = require('./CommunicationErrors');

const DEFAULT_STAGE_METADATA = Object.freeze({
  minimumMs: 100,
  typicalMs: 500,
  maximumMs: 3000,
  requiredPreconditions: [],
  produces: [],
  consumes: [],
  cacheable: false,
  cacheTtlMs: 0,
  retryable: false,
  interruptible: true,
  critical: true,
  skippable: false
});

const COMMUNICATION_STAGE_METADATA = Object.freeze({});

function nowMs() {
  return Date.now();
}

class DeadlineManager {
  constructor(context = {}, options = {}) {
    this.context = context;
    this.logger = options.logger || null;
  }

  remaining(fallbackMs = 1000, options = {}) {
    const minMs = Math.max(1, Number(options.minMs) || 1);
    const fallback = Math.max(minMs, Number(fallbackMs) || minMs);
    const deadlineAt = Number(this.context?.deadlineAt);
    if (!Number.isFinite(deadlineAt) || deadlineAt <= 0) return fallback;
    return Math.max(minMs, deadlineAt - nowMs());
  }

  stageBudget(stage, requestedMs, metadata = {}) {
    const maximumMs = Math.max(1, Number(metadata.maximumMs) || Number(requestedMs) || 1000);
    const requested = Math.max(1, Number(requestedMs) || maximumMs);
    return Math.min(requested, maximumMs, this.remaining(requested));
  }

  assertFeasible(stage, requestedMs, metadata = {}) {
    const minimumRequiredMs = Math.max(1, Number(metadata.minimumMs) || DEFAULT_STAGE_METADATA.minimumMs);
    const remainingMs = this.remaining(requestedMs, { minMs: 1 });
    const budgetMs = this.stageBudget(stage, requestedMs, metadata);
    if (remainingMs < minimumRequiredMs || budgetMs < minimumRequiredMs) {
      throw new InsufficientRemainingTimeError('communication', {
        stage,
        operationId: this.context?.operationId || null,
        deadlineAt: this.context?.deadlineAt || null,
        remainingMs,
        budgetMs,
        minimumRequiredMs,
        requestedMs
      });
    }
    return { budgetMs, remainingMs, minimumRequiredMs };
  }
}

class OperationScheduler {
  constructor(options = {}) {
    this.context = options.context || {};
    this.logger = options.logger || null;
    this.stageMetadata = {
      ...COMMUNICATION_STAGE_METADATA,
      ...(options.stageMetadata || {})
    };
    this.deadline = options.deadlineManager || new DeadlineManager(this.context, { logger: this.logger });
    this.context.stageCache = this.context.stageCache || new Map();
    this.context.stageResults = this.context.stageResults || new Map();
    this.context.stageExecutions = this.context.stageExecutions || new Map();
    this.context.activeStages = this.context.activeStages || new Set();
    this.context.sessionState = this.context.sessionState || {};
    this.context.timeline = this.context.timeline || [];
  }

  metadata(stage, overrides = {}) {
    return {
      ...DEFAULT_STAGE_METADATA,
      ...(this.stageMetadata[stage] || {}),
      ...overrides
    };
  }

  budget(stage, requestedMs, overrides = {}) {
    return this.deadline.stageBudget(stage, requestedMs, this.metadata(stage, overrides));
  }

  cacheValue(stage, value, overrides = {}) {
    const metadata = this.metadata(stage, overrides);
    const record = {
      value,
      createdAt: nowMs(),
      ttlMs: Number(metadata.cacheTtlMs) || 0,
      operationId: this.context.operationId || null,
      stage
    };
    this.context.stageCache.set(stage, record);
    this.context.stageResults.set(stage, value);
    this._publishOutputs(metadata, value);
    return value;
  }

  getCached(stage, overrides = {}) {
    const metadata = this.metadata(stage, overrides);
    const record = this.context.stageCache.get(stage);
    if (!record) return null;
    const ttlMs = Number(record.ttlMs || metadata.cacheTtlMs) || 0;
    if (ttlMs > 0 && nowMs() - record.createdAt > ttlMs) {
      this.context.stageCache.delete(stage);
      return null;
    }
    return record;
  }

  getOutput(name) {
    return this.context.sessionState?.[name];
  }

  setOutput(name, value) {
    this.context.sessionState[name] = value;
  }

  async execute(stage, work, options = {}) {
    const metadata = this.metadata(stage, options.metadata || {});
    const signal = options.signal || this.context.signal || null;
    const requestedMs = Math.max(1, Number(options.timeoutMs) || Number(metadata.maximumMs) || 1000);
    const startedAt = nowMs();
    throwIfAborted(signal);

    if (metadata.cacheable && options.forceRefresh !== true) {
      const cached = this.getCached(stage, metadata);
      if (cached) {
        this._log('info', 'stage cache hit', {
          stage,
          phase: 'planning',
          cachedResultUsed: true,
          operationId: this.context.operationId || null,
          ageMs: nowMs() - cached.createdAt
        });
        return cached.value;
      }
    }

    if (this.context.activeStages.has(stage)) {
      throw new DuplicateStageExecutionError('communication', {
        stage,
        operationId: this.context.operationId || null
      });
    }

    this._assertPreconditions(stage, metadata, options);
    let feasibility;
    try {
      feasibility = this.deadline.assertFeasible(stage, requestedMs, metadata);
    } catch (error) {
      if (error.code === 'INSUFFICIENT_REMAINING_TIME') {
        this._log('warn', 'stage skipped', {
          stage,
          phase: 'planning',
          operationId: this.context.operationId || null,
          deadlineAt: this.context.deadlineAt || null,
          skippedReason: error.code,
          minimumRequired: error.context?.minimumRequiredMs,
          budgetRemaining: error.context?.remainingMs
        });
        abortController(this.context.controller, error);
      }
      throw error;
    }
    const { budgetMs, remainingMs, minimumRequiredMs } = feasibility;
    this._log('info', 'scheduler decision', {
      stage,
      phase: 'budget-allocation',
      operationId: this.context.operationId || null,
      deadlineAt: this.context.deadlineAt || null,
      budgetAssigned: budgetMs,
      budgetRemaining: remainingMs,
      minimumRequired: minimumRequiredMs,
      cacheable: metadata.cacheable === true,
      interruptible: metadata.interruptible !== false
    });

    this.context.activeStages.add(stage);
    this.context.stageExecutions.set(stage, (this.context.stageExecutions.get(stage) || 0) + 1);
    let timer = null;
    try {
      this._log('info', 'stage started', {
        stage,
        phase: 'execution',
        operationId: this.context.operationId || null,
        deadlineAt: this.context.deadlineAt || null,
        budgetAssigned: budgetMs,
        cancelled: Boolean(signal?.aborted)
      });
      const value = await raceWithSignal(signal, () => Promise.race([
        Promise.resolve().then(() => {
          throwIfAborted(signal);
          return work({ budgetMs, signal, operationContext: this.context, scheduler: this });
        }),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            const error = createTimeoutError(
              `Communication ${stage} timed out after ${budgetMs}ms`,
              'COMMUNICATION_STAGE_TIMEOUT',
              {
                stage,
                operationId: this.context.operationId || null,
                deadlineAt: this.context.deadlineAt || null,
                budgetMs,
                minimumRequiredMs
              }
            );
            reject(error);
            abortController(this.context.controller, new DeadlineExceededError('communication', {
              stage,
              operationId: this.context.operationId || null,
              deadlineAt: this.context.deadlineAt || null,
              budgetMs
            }));
          }, budgetMs);
          timer.unref?.();
        })
      ]), error => {
        throw new StageCancelledError('communication', {
          stage,
          operationId: this.context.operationId || null,
          cause: createCancellationError(error)
        });
      });
      throwIfAborted(signal);
      const result = metadata.cacheable ? this.cacheValue(stage, value, metadata) : value;
      if (!metadata.cacheable) this._publishOutputs(metadata, value);
      this._log('info', 'stage completed', {
        stage,
        phase: 'completion',
        operationId: this.context.operationId || null,
        actualDuration: nowMs() - startedAt,
        budgetRemaining: this.deadline.remaining(budgetMs)
      });
      return result;
    } catch (error) {
      this._log('warn', 'stage failed', {
        stage,
        phase: 'cleanup',
        operationId: this.context.operationId || null,
        actualDuration: nowMs() - startedAt,
        code: error.code || null,
        error: error.message
      });
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
      this.context.activeStages.delete(stage);
    }
  }

  _assertPreconditions(stage, metadata, options = {}) {
    if (options.skipPreconditions === true) return;
    for (const precondition of metadata.requiredPreconditions || []) {
      if (this.context.sessionState?.[precondition] !== undefined) continue;
      throw new MissingPreconditionError('communication', {
        stage,
        precondition,
        operationId: this.context.operationId || null
      });
    }
  }

  _publishOutputs(metadata, value) {
    for (const output of metadata.produces || []) {
      if (value === undefined) continue;
      this.context.sessionState[output] = value;
    }
  }

  _log(level, message, data = {}) {
    this.context.timeline?.push?.({
      at: new Date().toISOString(),
      message,
      ...data
    });
    const fn = this.logger?.[level] || this.logger?.info;
    fn?.call(this.logger, '[OperationScheduler] ' + message, data);
  }
}

function createOperationScheduler(context = {}, options = {}) {
  if (context.scheduler instanceof OperationScheduler) {
    return context.scheduler;
  }
  const scheduler = new OperationScheduler({ ...options, context });
  context.scheduler = scheduler;
  return scheduler;
}

module.exports = {
  DeadlineManager,
  OperationScheduler,
  COMMUNICATION_STAGE_METADATA,
  createOperationScheduler
};
