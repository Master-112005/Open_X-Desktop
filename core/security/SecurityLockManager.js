const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { ensureDataRoot, readJsonFile, writeJsonAtomic, Normalizer, Logger } = require('../assistant/Data');

const ITERATIONS = 210000;
const KEY_LENGTH = 32;
const DIGEST = 'sha256';

function nowIso() {
  return new Date().toISOString();
}

function normalizeType(value) {
  return String(value || '').trim().toLowerCase();
}

function isSupportedType(type) {
  return type === 'app';
}

function normalizeTarget(value) {
  return Normalizer.normalizeText(String(value || '').trim());
}

function publicLock(lock) {
  return {
    id: lock.id,
    type: lock.type,
    target: lock.target,
    displayName: lock.displayName,
    lastKnownPath: lock.lastKnownPath || '',
    enabled: lock.enabled !== false,
    createdAt: lock.createdAt,
    updatedAt: lock.updatedAt,
    lastUnlockedAt: lock.lastUnlockedAt || null
  };
}

class SecurityLockManager {
  constructor(config = {}) {
    const dataPaths = config?.app?.dataPaths || ensureDataRoot(config);
    this.storePath = config.storePath || dataPaths.securityLocksPath || path.join(dataPaths.root, 'security', 'locks.json');
    this.logger = config.logger || new Logger(config?.logging || { level: 'info' });
    this._cache = null;
    this._cacheMtimeMs = 0;
  }

  listLocks() {
    return this._load().locks.filter(lock => lock.type === 'app').map(publicLock);
  }

  upsertLock(input = {}) {
    const type = normalizeType(input.type || 'app');
    if (!isSupportedType(type)) return { success: false, error: 'Only app locks are supported' };
    const target = normalizeTarget(input.target || input.displayName || input.path);
    const password = String(input.password || '');
    if (!target) return { success: false, error: 'Lock target is required' };
    if (password.length < 4) return { success: false, error: 'Password must be at least 4 characters' };

    const store = this._load();
    const existing = store.locks.find(lock => lock.type === type && lock.target === target);
    const record = existing || {
      id: crypto.randomUUID(),
      type,
      target,
      createdAt: nowIso()
    };

    record.displayName = String(input.displayName || input.target || target).trim();
    record.lastKnownPath = String(input.path || input.lastKnownPath || record.lastKnownPath || '').trim();
    record.passwordHash = this._hashPassword(password);
    record.enabled = input.enabled !== false;
    record.updatedAt = nowIso();

    if (!existing) store.locks.push(record);
    this._save(store);
    return { success: true, data: { lock: publicLock(record), locks: this.listLocks() } };
  }

  removeLock(input = {}) {
    const store = this._load();
    const id = String(input.id || '').trim();
    const type = normalizeType(input.type || 'app');
    const target = normalizeTarget(input.target || input.displayName || input.path);
    const index = store.locks.findIndex(lock => (
      id ? lock.id === id : (lock.type === type && lock.target === target)
    ));
    if (index < 0) return { success: false, error: 'Security lock not found' };
    const [removed] = store.locks.splice(index, 1);
    this._save(store);
    return { success: true, data: { lock: publicLock(removed), locks: this.listLocks() } };
  }

  updateTarget(input = {}) {
    const store = this._load();
    const type = normalizeType(input.type || 'app');
    if (!isSupportedType(type)) return { success: false, error: 'Only app locks are supported' };
    const oldTarget = normalizeTarget(input.oldTarget || input.target || input.oldPath);
    const newTarget = normalizeTarget(input.newTarget || input.newPath || input.path);
    if (!oldTarget || !newTarget) return { success: false, error: 'Old and new targets are required' };
    const lock = store.locks.find(candidate => candidate.type === type && (
      candidate.target === oldTarget || normalizeTarget(candidate.lastKnownPath) === oldTarget
    ));
    if (!lock) return { success: false, error: 'Security lock not found' };
    lock.target = newTarget;
    lock.displayName = String(input.displayName || input.newPath || input.newTarget || lock.displayName).trim();
    lock.lastKnownPath = String(input.newPath || input.path || lock.lastKnownPath || '').trim();
    lock.updatedAt = nowIso();
    this._save(store);
    return { success: true, data: { lock: publicLock(lock), locks: this.listLocks() } };
  }

  verify(input = {}) {
    const lock = this.findLock(input);
    if (!lock) return { success: false, error: 'Security lock not found' };
    const password = String(input.password || '');
    const verified = this._verifyPassword(password, lock.passwordHash);
    if (!verified) return { success: false, error: 'Incorrect password', data: { lock: publicLock(lock) } };
    lock.lastUnlockedAt = nowIso();
    this._save(this._load());
    return { success: true, data: { lock: publicLock(lock) } };
  }

  unlock(input = {}) {
    return this.verify(input);
  }

  findLock(input = {}) {
    const type = normalizeType(input.type || 'app');
    if (!isSupportedType(type)) return null;
    const id = String(input.id || '').trim();
    const target = normalizeTarget(input.target || input.displayName || input.path);
    const store = this._load();
    return store.locks.find(lock => lock.enabled !== false && (
      id ? lock.id === id : lock.type === type && (
        lock.target === target ||
        normalizeTarget(lock.displayName) === target
      )
    )) || null;
  }

  isLocked(input = {}) {
    return Boolean(this.findLock(input));
  }

  _hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
    return `pbkdf2$${DIGEST}$${ITERATIONS}$${salt.toString('base64')}$${hash.toString('base64')}`;
  }

  _verifyPassword(password, stored) {
    const parts = String(stored || '').split('$');
    if (parts.length !== 5 || parts[0] !== 'pbkdf2') return false;
    const [, digest, iterationsText, saltText, hashText] = parts;
    const expected = Buffer.from(hashText, 'base64');
    const actual = crypto.pbkdf2Sync(password, Buffer.from(saltText, 'base64'), Number(iterationsText), expected.length, digest);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }

  _load() {
    let mtimeMs = 0;
    try {
      mtimeMs = fs.existsSync(this.storePath) ? fs.statSync(this.storePath).mtimeMs : 0;
    } catch (_) {}
    if (this._cache && this._cacheMtimeMs === mtimeMs) return this._cache;
    const parsed = readJsonFile(this.storePath, { version: 1, locks: [] }, {
      validate: value => value && typeof value === 'object' && Array.isArray(value.locks),
      maxBytes: 512 * 1024
    });
    this._cache = {
      version: 1,
      locks: parsed.locks
        .filter(lock => lock && typeof lock === 'object' && lock.passwordHash)
        .map(lock => ({
          id: String(lock.id || crypto.randomUUID()),
          type: normalizeType(lock.type || 'app'),
          target: normalizeTarget(lock.target || lock.displayName || lock.lastKnownPath),
          displayName: String(lock.displayName || lock.target || '').trim(),
          lastKnownPath: String(lock.lastKnownPath || '').trim(),
          passwordHash: String(lock.passwordHash),
          enabled: lock.enabled !== false,
          createdAt: lock.createdAt || nowIso(),
          updatedAt: lock.updatedAt || nowIso(),
          lastUnlockedAt: lock.lastUnlockedAt || null
        }))
        .filter(lock => lock.type === 'app' && lock.target)
    };
    try {
      this._cacheMtimeMs = fs.statSync(this.storePath).mtimeMs;
    } catch (_) {
      this._cacheMtimeMs = 0;
    }
    return this._cache;
  }

  _save(store) {
    this._cache = store;
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true, mode: 0o700 });
    try { fs.chmodSync(path.dirname(this.storePath), 0o700); } catch (_) {}
    writeJsonAtomic(this.storePath, store, { maxBytes: 512 * 1024 });
    try {
      this._cacheMtimeMs = fs.statSync(this.storePath).mtimeMs;
    } catch (_) {
      this._cacheMtimeMs = 0;
    }
  }
}

module.exports = SecurityLockManager;
