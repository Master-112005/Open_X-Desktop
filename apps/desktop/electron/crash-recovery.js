const {
  readSecureJsonFile: readJsonFile,
  writeSecureJsonAtomic: writeJsonAtomic
} = require('../../../core/assistant/Data');

const CRASH_RECOVERY_SCHEMA_VERSION = 2;
const DEFAULT_MAX_RESTARTS = 3;
const DEFAULT_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_MAX_RENDERER_RECORDS = 12;

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function positiveFinite(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function compactElectronDetails(details = {}) {
  if (!details || typeof details !== 'object') return null;
  return {
    type: String(details.type || '').slice(0, 80),
    reason: String(details.reason || '').slice(0, 80),
    exitCode: Number.isFinite(details.exitCode) ? details.exitCode : null,
    serviceName: String(details.serviceName || '').slice(0, 80)
  };
}

function compactCrashMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object') return {};
  const memory = metadata.memory && typeof metadata.memory === 'object'
    ? {
        rss: Number(metadata.memory.rss) || 0,
        heapUsed: Number(metadata.memory.heapUsed) || 0,
        external: Number(metadata.memory.external) || 0
      }
    : null;
  return {
    origin: String(metadata.origin || '').slice(0, 80),
    reason: String(metadata.reason || '').replace(/\s+/g, ' ').trim().slice(0, 180),
    component: String(metadata.component || '').slice(0, 80),
    pid: Number(metadata.pid) || null,
    uptimeMs: Math.max(0, Math.round(Number(metadata.uptimeMs) || 0)),
    assistantInitialized: metadata.assistantInitialized === true,
    windows: metadata.windows && typeof metadata.windows === 'object'
        ? {
          chat: metadata.windows.chat === true,
          planner: metadata.windows.planner === true,
          gallery: metadata.windows.gallery === true,
          timer: metadata.windows.timer === true
      }
    : null,
    type: String(metadata.type || metadata.eventType || '').slice(0, 80),
    windowType: String(metadata.windowType || '').slice(0, 80),
    recoveryAction: String(metadata.recoveryAction || '').slice(0, 80),
    delayMs: Math.max(0, Math.round(Number(metadata.delayMs) || 0)),
    allowed: typeof metadata.allowed === 'boolean' ? metadata.allowed : null,
    errorCode: Number.isFinite(metadata.errorCode) ? Number(metadata.errorCode) : null,
    details: compactElectronDetails(metadata.details),
    memory
  };
}

class CrashRecoveryPolicy {
  constructor(options = {}) {
    if (!options.statePath) throw new TypeError('Crash recovery statePath is required');
    this.statePath = options.statePath;
    this.maxRestarts = positiveInteger(options.maxRestarts, DEFAULT_MAX_RESTARTS);
    this.windowMs = positiveFinite(options.windowMs, DEFAULT_WINDOW_MS);
    this.maxRendererRecords = positiveInteger(options.maxRendererRecords, DEFAULT_MAX_RENDERER_RECORDS);
  }

  readState(fallback = {}) {
    return readJsonFile(this.statePath, fallback);
  }

  writeState(state = {}, now = Date.now()) {
    writeJsonAtomic(this.statePath, {
      ...state,
      schemaVersion: CRASH_RECOVERY_SCHEMA_VERSION,
      updatedAt: now
    });
  }

  readCrashTimestamps(now = Date.now()) {
    const state = this.readState({ crashTimestamps: [] });
    return Array.isArray(state.crashTimestamps)
      ? state.crashTimestamps.filter(timestamp => (
        Number.isFinite(timestamp)
        && timestamp >= 0
        && timestamp <= now
        && now - timestamp < this.windowMs
      ))
      : [];
  }

  readCrashRecords(now = Date.now()) {
    const state = this.readState({ crashRecords: [], crashTimestamps: [] });
    if (Array.isArray(state.crashRecords)) {
      return state.crashRecords
        .filter(record => (
          record &&
          Number.isFinite(record.timestamp) &&
          record.timestamp >= 0 &&
          record.timestamp <= now &&
          now - record.timestamp < this.windowMs
        ))
        .slice(-this.maxRestarts);
    }
    return this.readCrashTimestamps(now).map(timestamp => ({ timestamp }));
  }

  readRendererCrashRecords(now = Date.now()) {
    const state = this.readState({ rendererCrashRecords: [] });
    return Array.isArray(state.rendererCrashRecords)
      ? state.rendererCrashRecords
        .filter(record => (
          record &&
          Number.isFinite(record.timestamp) &&
          record.timestamp >= 0 &&
          record.timestamp <= now
        ))
        .slice(-this.maxRendererRecords)
      : [];
  }

  getState(now = Date.now()) {
    const crashTimestamps = this.readCrashTimestamps(now);
    return {
      blocked: crashTimestamps.length >= this.maxRestarts,
      crashTimestamps,
      remainingRestarts: Math.max(0, this.maxRestarts - crashTimestamps.length)
    };
  }

  getDiagnostics(now = Date.now()) {
    const state = this.readState({});
    const crashRecords = this.readCrashRecords(now);
    const crashTimestamps = this.readCrashTimestamps(now);
    const rendererCrashRecords = this.readRendererCrashRecords(now);
    const recoveredCrashRecords = Array.isArray(state.recoveredCrashRecords)
      ? state.recoveredCrashRecords.slice(-this.maxRestarts)
      : [];
    return {
      ...this.getState(now),
      crashRecords,
      rendererCrashRecords,
      recoveredCrashRecords,
      lastCrash: state.lastCrash || crashRecords[crashRecords.length - 1] || null,
      lastRendererCrash: state.lastRendererCrash || rendererCrashRecords[rendererCrashRecords.length - 1] || null,
      blockedAt: Number.isFinite(state.blockedAt) ? state.blockedAt : null,
      stableAt: Number.isFinite(state.stableAt) ? state.stableAt : null,
      updatedAt: Number.isFinite(state.updatedAt) ? state.updatedAt : null,
      schemaVersion: Number.isFinite(state.schemaVersion) ? state.schemaVersion : 1,
      windowMs: this.windowMs,
      maxRestarts: this.maxRestarts,
      maxRendererRecords: this.maxRendererRecords,
      crashCount: crashTimestamps.length
    };
  }

  requestRestart(now = Date.now(), metadata = {}) {
    const state = this.readState({});
    const timestamps = this.readCrashTimestamps(now);
    const records = this.readCrashRecords(now);
    const rendererCrashRecords = this.readRendererCrashRecords(now);
    const crashMetadata = compactCrashMetadata(metadata);
    const nextRecord = { ...crashMetadata, timestamp: now };
    const recoveredCrashRecords = Array.isArray(state.recoveredCrashRecords)
      ? state.recoveredCrashRecords.slice(-this.maxRestarts)
      : [];

    if (timestamps.length >= this.maxRestarts) {
      this.writeState({
        crashTimestamps: timestamps,
        crashRecords: records,
        rendererCrashRecords,
        lastRendererCrash: state.lastRendererCrash || rendererCrashRecords[rendererCrashRecords.length - 1] || null,
        recoveredCrashRecords,
        blockedAt: now,
        lastCrash: nextRecord
      }, now);
      return false;
    }

    timestamps.push(now);
    records.push(nextRecord);
    this.writeState({
      crashTimestamps: timestamps,
      crashRecords: records.slice(-this.maxRestarts),
      rendererCrashRecords,
      lastRendererCrash: state.lastRendererCrash || rendererCrashRecords[rendererCrashRecords.length - 1] || null,
      recoveredCrashRecords,
      lastCrashAt: now,
      lastCrash: nextRecord
    }, now);
    return true;
  }

  recordRendererFailure(now = Date.now(), metadata = {}) {
    const state = this.readState({});
    const rendererCrashRecords = this.readRendererCrashRecords(now);
    const record = {
      ...compactCrashMetadata({
        component: 'renderer',
        origin: 'renderer-recovery',
        ...metadata
      }),
      timestamp: now
    };
    rendererCrashRecords.push(record);
    this.writeState({
      ...state,
      rendererCrashRecords: rendererCrashRecords.slice(-this.maxRendererRecords),
      lastRendererCrash: record
    }, now);
    return record;
  }

  markStable(now = Date.now()) {
    const state = this.readState({});
    const records = this.readCrashRecords(now);
    const rendererCrashRecords = this.readRendererCrashRecords(now);
    const recoveredCrashRecords = records.length > 0
      ? records.slice(-this.maxRestarts)
      : (Array.isArray(state.recoveredCrashRecords) ? state.recoveredCrashRecords.slice(-this.maxRestarts) : []);
    this.writeState({
      crashTimestamps: [],
      crashRecords: [],
      rendererCrashRecords,
      lastRendererCrash: state.lastRendererCrash || rendererCrashRecords[rendererCrashRecords.length - 1] || null,
      recoveredCrashRecords,
      lastCrash: state.lastCrash || recoveredCrashRecords[recoveredCrashRecords.length - 1] || null,
      stableAt: now
    }, now);
  }
}

module.exports = CrashRecoveryPolicy;
