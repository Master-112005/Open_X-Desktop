const crypto = require('crypto');
const { RECOVERY_STATES } = require('./RecoveryState');

function nowIso() {
  return new Date().toISOString();
}

class RecoverySession {
  constructor(input = {}) {
    this.sessionId = input.sessionId || `recovery-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    this.currentVersion = String(input.currentVersion || '').trim();
    this.previousVersion = String(input.previousVersion || input.currentVersion || '').trim();
    this.targetVersion = String(input.targetVersion || '').trim();
    this.failureReason = String(input.failureReason || '').trim();
    this.state = input.state || RECOVERY_STATES.IDLE;
    this.backupId = input.backupId || null;
    this.createdAt = input.createdAt || nowIso();
    this.updatedAt = input.updatedAt || this.createdAt;
    this.recoveryStart = input.recoveryStart || null;
    this.recoveryFinish = input.recoveryFinish || null;
    this.rollbackDurationMs = Number.isFinite(input.rollbackDurationMs) ? input.rollbackDurationMs : null;
    this.restartCount = Number.isInteger(input.restartCount) ? input.restartCount : 0;
    this.healthResult = input.healthResult || null;
    this.startupResult = input.startupResult || null;
    this.recoveryResult = input.recoveryResult || null;
    this.errors = Array.isArray(input.errors) ? input.errors.slice(0, 20) : [];
  }

  setState(state) {
    this.state = state;
    this.updatedAt = nowIso();
    return this;
  }

  setBackup(backup = {}) {
    this.backupId = backup.backupId || this.backupId;
    this.previousVersion = backup.currentVersion || this.previousVersion;
    this.targetVersion = backup.targetVersion || this.targetVersion;
    this.updatedAt = nowIso();
    return this;
  }

  startRecovery(reason = this.failureReason) {
    this.failureReason = String(reason || this.failureReason || '').trim();
    this.recoveryStart = nowIso();
    this.updatedAt = this.recoveryStart;
    return this;
  }

  finishRecovery(result = {}) {
    this.recoveryFinish = nowIso();
    this.recoveryResult = result;
    this.updatedAt = this.recoveryFinish;
    return this;
  }

  recordError(error) {
    const normalized = {
      message: error?.message || String(error || 'Unknown recovery error'),
      code: error?.code || null,
      at: nowIso()
    };
    this.errors.unshift(normalized);
    this.errors = this.errors.slice(0, 20);
    this.updatedAt = normalized.at;
    return this;
  }

  snapshot() {
    return {
      sessionId: this.sessionId,
      currentVersion: this.currentVersion,
      previousVersion: this.previousVersion,
      targetVersion: this.targetVersion,
      failureReason: this.failureReason,
      state: this.state,
      backupId: this.backupId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      recoveryStart: this.recoveryStart,
      recoveryFinish: this.recoveryFinish,
      rollbackDurationMs: this.rollbackDurationMs,
      restartCount: this.restartCount,
      healthResult: this.healthResult,
      startupResult: this.startupResult,
      recoveryResult: this.recoveryResult,
      errors: this.errors.slice()
    };
  }
}

module.exports = RecoverySession;
