const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { buildDataPaths, readJsonFile, writeJsonAtomic } = require('../../core/assistant/Data');

const CURRENT_VERSION = 1;
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const ITERATIONS = 210000;
const DIGEST = 'sha256';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

function normalizePassword(value) {
  return String(value || '');
}

function passwordQuality(password) {
  const value = normalizePassword(password);
  return {
    length: value.length,
    valid: value.length >= 8 && value.length <= 256,
  };
}

function timingSafeEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'hex');
  const rightBuffer = Buffer.from(String(right || ''), 'hex');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

class OpenXSecurityLock {
  constructor(options = {}) {
    const securityDir = options.securityDir || path.join(options.dataRoot || buildDataPaths().root, 'security');
    this.lockPath = options.lockPath || path.join(securityDir, 'assistant-lock.json');
    this.now = options.now || (() => Date.now());
    this.failedAttempts = 0;
    this.lockedUntil = 0;
    fs.mkdirSync(path.dirname(this.lockPath), { recursive: true });
  }

  getStatus() {
    const record = this.readRecord();
    return {
      configured: Boolean(record?.passwordHash && record?.salt),
      locked: this.isLocked(),
      lockedUntil: this.isLocked() ? this.lockedUntil : null,
      failedAttempts: this.failedAttempts,
      maxFailedAttempts: MAX_FAILED_ATTEMPTS,
      updatedAt: record?.updatedAt || null,
    };
  }

  verify(password) {
    if (this.isLocked()) {
      return { success: false, code: 'locked', message: 'OpenX security lock is temporarily locked.', status: this.getStatus() };
    }

    const record = this.readRecord();
    if (!record?.passwordHash || !record?.salt) {
      return { success: false, code: 'not-configured', message: 'Set an OpenX security password first.', status: this.getStatus() };
    }

    const candidate = this.hashPassword(password, record.salt, record.iterations || ITERATIONS);
    if (!timingSafeEqualText(candidate, record.passwordHash)) {
      this.failedAttempts += 1;
      if (this.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        this.lockedUntil = this.now() + LOCKOUT_MS;
      }
      return { success: false, code: 'invalid-password', message: 'Incorrect OpenX security password.', status: this.getStatus() };
    }

    this.failedAttempts = 0;
    this.lockedUntil = 0;
    return { success: true, status: this.getStatus() };
  }

  setPassword({ currentPassword = '', newPassword = '' } = {}) {
    const quality = passwordQuality(newPassword);
    if (!quality.valid) {
      return { success: false, code: 'weak-password', message: 'Use at least 8 characters for the OpenX security password.', status: this.getStatus() };
    }

    const status = this.getStatus();
    if (status.configured) {
      const verified = this.verify(currentPassword);
      if (verified.success !== true) return verified;
    }

    const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
    const passwordHash = this.hashPassword(newPassword, salt, ITERATIONS);
    writeJsonAtomic(this.lockPath, {
      version: CURRENT_VERSION,
      algorithm: 'pbkdf2',
      digest: DIGEST,
      iterations: ITERATIONS,
      salt,
      passwordHash,
      updatedAt: new Date(this.now()).toISOString(),
    });
    this.failedAttempts = 0;
    this.lockedUntil = 0;
    return { success: true, status: this.getStatus() };
  }

  readRecord() {
    try {
      return readJsonFile(this.lockPath, null);
    } catch {
      return null;
    }
  }

  hashPassword(password, salt, iterations) {
    return crypto.pbkdf2Sync(normalizePassword(password), Buffer.from(String(salt), 'hex'), Number(iterations) || ITERATIONS, KEY_BYTES, DIGEST).toString('hex');
  }

  isLocked() {
    return Number(this.lockedUntil) > this.now();
  }
}

module.exports = OpenXSecurityLock;
