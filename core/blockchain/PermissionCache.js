'use strict';

const fs = require('fs');
const path = require('path');
const PermissionRecord = require('./PermissionRecord');
const { PermissionCacheError } = require('./BlockchainErrors');

class PermissionCache {
  constructor(options = {}) {
    this.filePath = options.filePath || null;
    this.defaultTtlMs = Number(options.defaultTtlMs) || 24 * 60 * 60 * 1000;
    this.records = new Map();
    this.loaded = false;
  }

  async load() {
    if (this.loaded) return this.list();
    this.loaded = true;
    if (!this.filePath) return this.list();
    try {
      if (!fs.existsSync(this.filePath)) return [];
      const raw = fs.readFileSync(this.filePath, 'utf8').trim();
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      for (const item of parsed) this.set(PermissionRecord.normalize(item), { persist: false });
      return this.list();
    } catch (error) {
      throw new PermissionCacheError('Unable to load permission cache.', {
        code: 'BLOCKCHAIN_PERMISSION_CACHE_LOAD_FAILED',
        cause: error
      });
    }
  }

  get(deviceId, permissionName) {
    return this.records.get(cacheKey(deviceId, permissionName)) || null;
  }

  set(record, options = {}) {
    const permission = PermissionRecord.normalize(record);
    if (!permission.deviceId || !permission.permissionName) {
      throw new PermissionCacheError('Permission cache record requires device ID and permission name.', {
        code: 'BLOCKCHAIN_PERMISSION_CACHE_KEY_REQUIRED'
      });
    }
    this.records.set(cacheKey(permission.deviceId, permission.permissionName), permission.toJSON());
    if (options.persist !== false) return this.flush().then(() => permission.toJSON());
    return permission.toJSON();
  }

  invalidate(deviceId, permissionName) {
    const key = cacheKey(deviceId, permissionName);
    const record = this.records.get(key);
    if (!record) return null;
    const expired = PermissionRecord.normalize(record).with({
      status: 'EXPIRED',
      expiresAt: new Date(Date.now() - 1).toISOString()
    }).toJSON();
    this.records.set(key, expired);
    return this.flush().then(() => expired);
  }

  list(deviceId = '') {
    const id = String(deviceId || '').trim();
    return [...this.records.values()]
      .filter(record => !id || record.deviceId === id)
      .map(record => ({ ...record }));
  }

  async flush() {
    if (!this.filePath) return true;
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
      const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tempPath, `${JSON.stringify(this.list(), null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
      fs.renameSync(tempPath, this.filePath);
      try { fs.chmodSync(this.filePath, 0o600); } catch (_) {}
      return true;
    } catch (error) {
      throw new PermissionCacheError('Unable to save permission cache.', {
        code: 'BLOCKCHAIN_PERMISSION_CACHE_SAVE_FAILED',
        cause: error
      });
    }
  }
}

function cacheKey(deviceId, permissionName) {
  return `${String(deviceId || '').trim()}::${String(permissionName || '').trim()}`;
}

module.exports = PermissionCache;
