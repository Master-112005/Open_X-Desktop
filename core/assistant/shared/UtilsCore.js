'use strict';

// Merged: ValidationHelpers, DeepClone, ErrorHelpers, LoggerHelpers, ObjectFreeze,
//         IdGenerator, Cancellation, AsyncHelpers, PerformanceTracker, ServiceContainer,
//         Stopwatch, Timer, ConfigurationLoader

const crypto = require('crypto');

const UTILS_VERSION = '1.1.0';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function requiredString(value, fieldName) {
  const text = String(value || '').trim();
  if (!text) {
    throw new Error(`${fieldName || 'value'} is required.`);
  }
  return text;
}

function optionalObject(value, fallback = {}) {
  return isPlainObject(value) ? value : fallback;
}

function optionalArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampNumber(value, min, max, fallback = min) {
  const number = finiteNumber(value, fallback);
  return Math.max(min, Math.min(max, number));
}

function compactString(value, maxLength = 240) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

const ValidationHelpers = {
  clampNumber,
  compactString,
  finiteNumber,
  isPlainObject,
  optionalArray,
  optionalObject,
  requiredString
};

function deepClone(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (Buffer.isBuffer?.(value)) return Buffer.from(value);
  if (seen.has(value)) return seen.get(value);
  if (Array.isArray(value)) {
    const output = [];
    seen.set(value, output);
    value.forEach(item => output.push(deepClone(item, seen)));
    return output;
  }
  if (value instanceof Map) {
    const output = new Map();
    seen.set(value, output);
    for (const [key, item] of value.entries()) {
      output.set(deepClone(key, seen), deepClone(item, seen));
    }
    return output;
  }
  if (value instanceof Set) {
    const output = new Set();
    seen.set(value, output);
    for (const item of value.values()) {
      output.add(deepClone(item, seen));
    }
    return output;
  }
  const output = {};
  seen.set(value, output);
  Object.keys(value).forEach(key => {
    output[key] = deepClone(value[key], seen);
  });
  return output;
}

const SENSITIVE_KEY_PATTERN = /(password|passcode|token|secret|api[_-]?key|private[_-]?key|otp|pin|credential)/i;

function compactText(value, maxLength = 500) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trim()}...` : text;
}

function sanitizeDetails(value, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return compactText(value, 300);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    if (depth >= 3) return '[array]';
    return value.slice(0, 10).map(item => sanitizeDetails(item, depth + 1, seen));
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    if (depth >= 3) return '[object]';
    const output = {};
    for (const [key, item] of Object.entries(value).slice(0, 30)) {
      output[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : sanitizeDetails(item, depth + 1, seen);
    }
    return output;
  }
  return String(value);
}

function normalizeError(error, fallbackMessage = 'Unexpected pipeline error.') {
  if (error instanceof Error) return error;
  const normalized = new Error(error ? String(error) : fallbackMessage);
  normalized.original = error;
  return normalized;
}

function serializeError(error) {
  const normalized = normalizeError(error);
  return {
    name: normalized.name,
    message: compactText(normalized.message, 500),
    code: normalized.code || null,
    stack: normalized.stack || null,
    details: sanitizeDetails(normalized.details || normalized.context || null),
    cause: normalized.cause ? {
      name: normalized.cause.name || 'Error',
      message: compactText(normalized.cause.message || normalized.cause, 300),
      code: normalized.cause.code || null
    } : null
  };
}

const ErrorHelpers = {
  normalizeError,
  sanitizeDetails,
  serializeError
};

function normalizeArgs(args) {
  if (args.length <= 1) return args;
  return [args[0], sanitizeDetails(args[1])];
}

function safeLogger(logger = null) {
  const noop = () => {};
  const bind = level => (...args) => {
    const fn = logger?.[level];
    if (typeof fn !== 'function') return noop();
    return fn.apply(logger, normalizeArgs(args));
  };
  return {
    debug: bind('debug'),
    info: bind('info'),
    warn: bind('warn'),
    error: bind('error')
  };
}

const LoggerHelpers = {
  normalizeArgs,
  safeLogger
};

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (seen.has(value)) return value;
  seen.add(value);
  Object.freeze(value);
  Object.keys(value).forEach(key => deepFreeze(value[key], seen));
  if (value instanceof Map) {
    for (const [key, item] of value.entries()) {
      deepFreeze(key, seen);
      deepFreeze(item, seen);
    }
  }
  if (value instanceof Set) {
    for (const item of value.values()) {
      deepFreeze(item, seen);
    }
  }
  return value;
}

const DEFAULT_PREFIX = 'id';

class IdGenerator {
  constructor(options = {}) {
    this.prefix = String(options.prefix || DEFAULT_PREFIX).replace(/[^a-z0-9_-]/gi, '').toLowerCase() || DEFAULT_PREFIX;
    this.random = typeof options.random === 'function' ? options.random : Math.random;
    this.now = typeof options.now === 'function' ? options.now : Date.now;
    this.counter = 0;
  }

  next(prefix = this.prefix) {
    const safePrefix = String(prefix || this.prefix).replace(/[^a-z0-9_-]/gi, '').toLowerCase() || DEFAULT_PREFIX;
    const time = this.now().toString(36);
    const counter = (this.counter = (this.counter + 1) % 1679616).toString(36).padStart(4, '0');
    const entropy = this._entropy();
    return `${safePrefix}_${time}_${counter}_${entropy}`;
  }

  _entropy() {
    if (crypto.randomBytes) {
      return crypto.randomBytes(4).toString('hex');
    }
    return this.random().toString(36).slice(2, 10).padEnd(8, '0').slice(0, 8);
  }
}

const DEFAULT_CANCEL_CODE = 'operation_cancelled';
const DEFAULT_TIMEOUT_CODE = 'operation_timeout';

function createCancellationError(signalOrReason, fallbackMessage = 'Operation cancelled') {
  const reason = signalOrReason?.reason !== undefined ? signalOrReason.reason : signalOrReason;
  if (reason instanceof Error) {
    if (!reason.code) reason.code = DEFAULT_CANCEL_CODE;
    return reason;
  }
  const message = typeof reason === 'string'
    ? reason
    : reason?.message || fallbackMessage;
  const error = new Error(message);
  error.name = 'CancellationError';
  error.code = reason?.code || DEFAULT_CANCEL_CODE;
  if (reason?.details) error.details = reason.details;
  return error;
}

function createTimeoutError(message, code = 'operation_timeout', details = {}) {
  const error = new Error(message);
  error.name = 'TimeoutError';
  error.code = code || DEFAULT_TIMEOUT_CODE;
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

function deadlineContext(timeoutMs, context = {}) {
  const existing = Number(context?.deadlineAt);
  if (Number.isFinite(existing) && existing > 0) {
    return { ...context, deadlineAt: existing };
  }
  return { ...context, deadlineAt: deadlineFromTimeout(timeoutMs) };
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
    try {
      controller.abort(reason);
    } catch (_) {
      controller.abort();
    }
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

function anySignal(signals = []) {
  const usable = signals.filter(Boolean);
  if (usable.length === 0) return null;
  if (usable.some(signal => signal.aborted)) {
    const controller = new AbortController();
    const aborted = usable.find(signal => signal.aborted);
    abortController(controller, createCancellationError(aborted));
    return controller.signal;
  }
  const controller = new AbortController();
  const cleanups = usable.map(signal => linkAbortSignal(signal, controller));
  controller.signal.addEventListener?.('abort', () => cleanups.forEach(cleanup => cleanup()), { once: true });
  return controller.signal;
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

const Cancellation = {
  abortController,
  anySignal,
  createCancellationError,
  createTimeoutError,
  deadlineContext,
  deadlineFromTimeout,
  isCancellationError,
  isTimeoutError,
  linkAbortSignal,
  raceWithSignal,
  remainingTimeMs,
  stageTimeoutMs,
  throwIfAborted
};

function isPromiseLike(value) {
  return Boolean(value) && typeof value.then === 'function';
}

function sleep(delayMs, value) {
  return new Promise(resolve => {
    const handle = setTimeout(() => resolve(value), Math.max(0, Number(delayMs) || 0));
    if (typeof handle.unref === 'function') handle.unref();
  });
}

function defer() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function withTimeout(promise, timeoutMs, createError) {
  const ms = Number(timeoutMs);
  if (!Number.isFinite(ms) || ms <= 0) return promise;
  let handle = null;
  const operation = Promise.resolve(promise);
  const timeout = new Promise((_, reject) => {
    handle = setTimeout(() => {
      const error = typeof createError === 'function' ? createError() : new Error('Operation timed out.');
      if (error && !error.code) error.code = 'operation_timeout';
      reject(error);
    }, ms);
    if (typeof handle.unref === 'function') handle.unref();
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (handle) clearTimeout(handle);
  }
}

const AsyncHelpers = {
  defer,
  isPromiseLike,
  sleep,
  withTimeout
};

class PerformanceTracker {
  constructor(options = {}) {
    this.records = [];
    this.maxRecords = Math.max(1, Number(options.maxRecords) || 500);
    this.now = typeof options.now === 'function' ? options.now : Date.now;
  }

  record(name, durationMs, metadata = {}) {
    const record = {
      name: String(name || 'operation'),
      durationMs: Math.max(0, Number(durationMs) || 0),
      metadata: sanitizeDetails(metadata || {}),
      timestamp: this.now()
    };
    this.records.push(record);
    this.records = this.records.slice(-this.maxRecords);
    return record;
  }

  list(limit = 100) {
    return this.records.slice(-Math.max(1, Number(limit) || 100));
  }

  summary(limit = 100) {
    const records = this.list(limit);
    const total = records.reduce((sum, item) => sum + item.durationMs, 0);
    const slowest = records.reduce((max, item) => item.durationMs > (max?.durationMs || -1) ? item : max, null);
    return {
      count: records.length,
      totalDurationMs: Math.round(total * 1000) / 1000,
      averageDurationMs: records.length ? Math.round((total / records.length) * 1000) / 1000 : 0,
      slowest
    };
  }

  clear() {
    const count = this.records.length;
    this.records = [];
    return count;
  }
}

class ServiceContainer {
  constructor(parent = null) {
    this.parent = parent;
    this.factories = new Map();
    this.instances = new Map();
    this.resolving = new Set();
  }

  register(name, factoryOrValue) {
    const key = String(name || '').trim();
    if (!key) throw new Error('Service name is required.');
    this.factories.set(key, factoryOrValue);
    this.instances.delete(key);
    return this;
  }

  has(name) {
    const key = String(name || '').trim();
    return this.factories.has(key) || this.instances.has(key) || Boolean(this.parent?.has?.(key));
  }

  resolve(name) {
    const key = String(name || '').trim();
    if (this.instances.has(key)) return this.instances.get(key);
    if (this.factories.has(key)) {
      if (this.resolving.has(key)) {
        throw new Error(`Circular service dependency: ${key}`);
      }
      const factory = this.factories.get(key);
      this.resolving.add(key);
      try {
        const instance = typeof factory === 'function' ? factory(this) : factory;
        this.instances.set(key, instance);
        return instance;
      } finally {
        this.resolving.delete(key);
      }
    }
    if (this.parent?.resolve) return this.parent.resolve(key);
    return undefined;
  }

  unregister(name) {
    const key = String(name || '').trim();
    this.factories.delete(key);
    this.instances.delete(key);
    return this;
  }

  clear() {
    this.factories.clear();
    this.instances.clear();
    this.resolving.clear();
    return this;
  }

  createScope() {
    return new ServiceContainer(this);
  }
}

class Stopwatch {
  constructor(clock = null) {
    this.clock = clock || (() => {
      if (typeof process !== 'undefined' && process.hrtime?.bigint) {
        return Number(process.hrtime.bigint()) / 1000000;
      }
      return Date.now();
    });
    this.startedAt = 0;
    this.stoppedAt = 0;
    this.running = false;
    this.laps = [];
  }

  start() {
    this.startedAt = this.clock();
    this.stoppedAt = 0;
    this.running = true;
    this.laps = [];
    return this;
  }

  stop() {
    if (this.running) {
      this.stoppedAt = this.clock();
      this.running = false;
    }
    return this.elapsedMs();
  }

  elapsedMs() {
    if (!this.startedAt) return 0;
    const end = this.running ? this.clock() : this.stoppedAt;
    return Math.max(0, Math.round((end - this.startedAt) * 1000) / 1000);
  }

  lap(label = '') {
    const entry = {
      label: String(label || ''),
      elapsedMs: this.elapsedMs(),
      timestamp: Date.now()
    };
    this.laps.push(entry);
    return entry;
  }

  reset() {
    this.startedAt = 0;
    this.stoppedAt = 0;
    this.running = false;
    this.laps = [];
    return this;
  }

  snapshot() {
    return {
      running: this.running,
      elapsedMs: this.elapsedMs(),
      laps: this.laps.slice()
    };
  }
}

class Timer {
  constructor(options = {}) {
    this.setTimeoutImpl = options.setTimeout || setTimeout;
    this.clearTimeoutImpl = options.clearTimeout || clearTimeout;
    this.handle = null;
  }

  start(callback, delayMs) {
    this.clear();
    this.handle = this.setTimeoutImpl(() => {
      this.handle = null;
      callback?.();
    }, Math.max(0, Number(delayMs) || 0));
    if (typeof this.handle?.unref === 'function') this.handle.unref();
    return this.handle;
  }

  restart(callback, delayMs) {
    return this.start(callback, delayMs);
  }

  active() {
    return this.handle !== null;
  }

  wait(delayMs) {
    return new Promise(resolve => {
      this.start(resolve, delayMs);
    });
  }

  clear() {
    if (this.handle) this.clearTimeoutImpl(this.handle);
    this.handle = null;
    return this;
  }
}

function mergeDeep(base, override) {
  const output = isPlainObject(base) ? deepClone(base) : {};
  if (!isPlainObject(override)) return output;

  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value) && isPlainObject(output[key])) {
      output[key] = mergeDeep(output[key], value);
    } else {
      output[key] = deepClone(value);
    }
  }
  return output;
}

class ConfigurationLoader {
  constructor(defaults = {}) {
    this.defaults = isPlainObject(defaults) ? deepClone(defaults) : {};
  }

  load(overrides = {}) {
    return mergeDeep(this.defaults, overrides);
  }
}

ConfigurationLoader.mergeDeep = mergeDeep;

module.exports = {
  UTILS_VERSION,
  AsyncHelpers,
  Cancellation,
  ConfigurationLoader,
  DeepClone: deepClone,
  ErrorHelpers,
  IdGenerator,
  LoggerHelpers,
  ObjectFreeze: deepFreeze,
  PerformanceTracker,
  ServiceContainer,
  Stopwatch,
  Timer,
  ValidationHelpers,
  abortController,
  anySignal,
  clampNumber,
  compactString,
  compactText,
  createCancellationError,
  createTimeoutError,
  deadlineContext,
  deadlineFromTimeout,
  deepClone,
  deepFreeze,
  defer,
  finiteNumber,
  isCancellationError,
  isPlainObject,
  isPromiseLike,
  isTimeoutError,
  linkAbortSignal,
  mergeDeep,
  normalizeArgs,
  normalizeError,
  optionalArray,
  optionalObject,
  raceWithSignal,
  remainingTimeMs,
  requiredString,
  safeLogger,
  sanitizeDetails,
  serializeError,
  sleep,
  stageTimeoutMs,
  throwIfAborted,
  withTimeout
};