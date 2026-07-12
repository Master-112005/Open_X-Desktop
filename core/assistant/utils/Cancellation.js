'use strict';

function createCancellationError(signalOrReason, fallbackMessage = 'Operation cancelled') {
  const reason = signalOrReason?.reason !== undefined ? signalOrReason.reason : signalOrReason;
  if (reason instanceof Error) {
    if (!reason.code) reason.code = 'operation_cancelled';
    return reason;
  }
  const message = typeof reason === 'string'
    ? reason
    : reason?.message || fallbackMessage;
  const error = new Error(message);
  error.code = reason?.code || 'operation_cancelled';
  return error;
}

function createTimeoutError(message, code = 'operation_timeout', details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function isCancellationError(error) {
  return error?.code === 'operation_cancelled' ||
    error?.code === 'command_timeout' ||
    error?.name === 'AbortError' ||
    error?.name === 'TimeoutError';
}

function isTimeoutError(error) {
  return error?.code === 'command_timeout' ||
    error?.code === 'operation_timeout' ||
    error?.code === 'COMMUNICATION_STAGE_TIMEOUT' ||
    error?.name === 'TimeoutError';
}

function deadlineFromTimeout(timeoutMs, now = Date.now()) {
  const value = Number(timeoutMs);
  return Number.isFinite(value) && value > 0 ? now + value : null;
}

function remainingTimeMs(context = {}, fallbackMs = 1000, options = {}) {
  const minMs = Math.max(1, Number(options.minMs) || 1);
  const fallback = Math.max(minMs, Number(fallbackMs) || minMs);
  const deadlineAt = Number(context?.deadlineAt);
  if (!Number.isFinite(deadlineAt) || deadlineAt <= 0) {
    return fallback;
  }
  return Math.max(minMs, deadlineAt - Date.now());
}

function stageTimeoutMs(context = {}, stageLimitMs = 1000, fallbackMs = stageLimitMs) {
  const limit = Math.max(1, Number(stageLimitMs) || Number(fallbackMs) || 1000);
  return Math.min(limit, remainingTimeMs(context, limit));
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw createCancellationError(signal);
  }
}

function abortController(controller, reason) {
  if (!controller) return;
  if (!controller.signal?.aborted) {
    controller.abort(reason);
  }
}

function linkAbortSignal(parentSignal, controller) {
  if (!parentSignal || !controller) return () => {};
  if (parentSignal.aborted) {
    abortController(controller, createCancellationError(parentSignal));
    return () => {};
  }
  const abort = () => abortController(controller, createCancellationError(parentSignal));
  parentSignal.addEventListener?.('abort', abort, { once: true });
  return () => parentSignal.removeEventListener?.('abort', abort);
}

async function raceWithSignal(signal, work, onAbort) {
  throwIfAborted(signal);
  if (!signal) {
    return Promise.resolve().then(work);
  }

  let abortHandler = null;
  const abortPromise = new Promise((_, reject) => {
    abortHandler = () => {
      const error = createCancellationError(signal);
      Promise.resolve()
        .then(() => onAbort?.(error))
        .then(() => reject(error))
        .catch(cleanupError => {
          error.cleanupError = cleanupError;
          reject(error);
        });
    };
    signal.addEventListener?.('abort', abortHandler, { once: true });
  });

  try {
    return await Promise.race([
      Promise.resolve().then(work),
      abortPromise
    ]);
  } finally {
    if (abortHandler) {
      signal.removeEventListener?.('abort', abortHandler);
    }
  }
}

module.exports = {
  abortController,
  createCancellationError,
  createTimeoutError,
  deadlineFromTimeout,
  isCancellationError,
  isTimeoutError,
  linkAbortSignal,
  raceWithSignal,
  remainingTimeMs,
  stageTimeoutMs,
  throwIfAborted
};
