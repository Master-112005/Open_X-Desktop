'use strict';

const fs = require('fs');
const path = require('path');
const DeviceTrust = require('./DeviceTrust');
const { TrustCacheError } = require('./BlockchainErrors');

class TrustCache {
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
      for (const item of parsed) this.set(DeviceTrust.normalize(item), { persist: false });
      return this.list();
    } catch (error) {
      throw new TrustCacheError('Unable to load device trust cache.', {
        code: 'BLOCKCHAIN_TRUST_CACHE_LOAD_FAILED',
        cause: error
      });
    }
  }

  get(deviceId) {
    return this.records.get(String(deviceId || '').trim()) || null;
  }

  set(record, options = {}) {
    const trust = DeviceTrust.normalize(record);
    if (!trust.deviceId) {
      throw new TrustCacheError('Device trust record requires a device ID.', {
        code: 'BLOCKCHAIN_TRUST_DEVICE_ID_REQUIRED'
      });
    }
    this.records.set(trust.deviceId, trust.toJSON());
    if (options.persist !== false) return this.flush().then(() => trust.toJSON());
    return trust.toJSON();
  }

  invalidate(deviceId) {
    const id = String(deviceId || '').trim();
    const record = this.records.get(id);
    if (!record) return null;
    const expired = DeviceTrust.normalize(record).with({
      trustStatus: 'EXPIRED',
      expiresAt: new Date(Date.now() - 1).toISOString()
    }).toJSON();
    this.records.set(id, expired);
    return this.flush().then(() => expired);
  }

  list() {
    return [...this.records.values()].map(record => ({ ...record }));
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
      throw new TrustCacheError('Unable to save device trust cache.', {
        code: 'BLOCKCHAIN_TRUST_CACHE_SAVE_FAILED',
        cause: error
      });
    }
  }
}

module.exports = TrustCache;
