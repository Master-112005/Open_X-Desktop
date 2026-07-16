const { readJsonFile, writeJsonAtomic } = require('../../../core/assistant/Data');

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
    voiceState: String(metadata.voiceState || '').slice(0, 40),
    windows: metadata.windows && typeof metadata.windows === 'object'
        ? {
          chat: metadata.windows.chat === true,
          voice: metadata.windows.voice === true,
          planner: metadata.windows.planner === true,
          gallery: metadata.windows.gallery === true,
          timer: metadata.windows.timer === true
        }
      : null,
    memory
  };
}

class CrashRecoveryPolicy {
  constructor(options = {}) {
    if (!options.statePath) throw new TypeError('Crash recovery statePath is required');
    this.statePath = options.statePath;
    this.maxRestarts = Number.isInteger(options.maxRestarts) ? options.maxRestarts : 3;
    this.windowMs = Number.isFinite(options.windowMs) ? options.windowMs : 5 * 60 * 1000;
  }

  readCrashTimestamps(now = Date.now()) {
    const state = readJsonFile(this.statePath, { crashTimestamps: [] });
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
    const state = readJsonFile(this.statePath, { crashRecords: [], crashTimestamps: [] });
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

  getState(now = Date.now()) {
    const crashTimestamps = this.readCrashTimestamps(now);
    return {
      blocked: crashTimestamps.length >= this.maxRestarts,
      crashTimestamps,
      remainingRestarts: Math.max(0, this.maxRestarts - crashTimestamps.length)
    };
  }

  getDiagnostics(now = Date.now()) {
    const state = readJsonFile(this.statePath, {});
    const crashRecords = this.readCrashRecords(now);
    const crashTimestamps = this.readCrashTimestamps(now);
    const recoveredCrashRecords = Array.isArray(state.recoveredCrashRecords)
      ? state.recoveredCrashRecords.slice(-this.maxRestarts)
      : [];
    return {
      ...this.getState(now),
      crashRecords,
      recoveredCrashRecords,
      lastCrash: state.lastCrash || crashRecords[crashRecords.length - 1] || null,
      blockedAt: Number.isFinite(state.blockedAt) ? state.blockedAt : null,
      stableAt: Number.isFinite(state.stableAt) ? state.stableAt : null,
      windowMs: this.windowMs,
      maxRestarts: this.maxRestarts,
      crashCount: crashTimestamps.length
    };
  }

  requestRestart(now = Date.now(), metadata = {}) {
    const state = readJsonFile(this.statePath, {});
    const timestamps = this.readCrashTimestamps(now);
    const records = this.readCrashRecords(now);
    const crashMetadata = compactCrashMetadata(metadata);
    const nextRecord = { ...crashMetadata, timestamp: now };
    const recoveredCrashRecords = Array.isArray(state.recoveredCrashRecords)
      ? state.recoveredCrashRecords.slice(-this.maxRestarts)
      : [];

    if (timestamps.length >= this.maxRestarts) {
      writeJsonAtomic(this.statePath, {
        crashTimestamps: timestamps,
        crashRecords: records,
        recoveredCrashRecords,
        blockedAt: now,
        lastCrash: nextRecord
      });
      return false;
    }

    timestamps.push(now);
    records.push(nextRecord);
    writeJsonAtomic(this.statePath, {
      crashTimestamps: timestamps,
      crashRecords: records.slice(-this.maxRestarts),
      recoveredCrashRecords,
      lastCrashAt: now,
      lastCrash: nextRecord
    });
    return true;
  }

  markStable(now = Date.now()) {
    const state = readJsonFile(this.statePath, {});
    const records = this.readCrashRecords(now);
    const recoveredCrashRecords = records.length > 0
      ? records.slice(-this.maxRestarts)
      : (Array.isArray(state.recoveredCrashRecords) ? state.recoveredCrashRecords.slice(-this.maxRestarts) : []);
    writeJsonAtomic(this.statePath, {
      crashTimestamps: [],
      crashRecords: [],
      recoveredCrashRecords,
      lastCrash: state.lastCrash || recoveredCrashRecords[recoveredCrashRecords.length - 1] || null,
      stableAt: now
    });
  }
}

module.exports = CrashRecoveryPolicy;
