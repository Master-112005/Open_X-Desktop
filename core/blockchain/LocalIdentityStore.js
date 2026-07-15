'use strict';

const fs = require('fs');
const path = require('path');
const DeviceIdentity = require('./DeviceIdentity');
const { IdentityStorageError } = require('./BlockchainErrors');

class LocalIdentityStore {
  constructor(options = {}) {
    this.filePath = options.filePath || null;
    this.deviceType = options.deviceType || 'desktop';
    this.memoryIdentity = null;
  }

  async load() {
    if (!this.filePath) return this.memoryIdentity;
    try {
      if (!fs.existsSync(this.filePath)) return null;
      const raw = fs.readFileSync(this.filePath, 'utf8');
      const parsed = raw.trim() ? JSON.parse(raw) : null;
      return parsed ? DeviceIdentity.normalize(parsed, this.deviceType).toJSON() : null;
    } catch (error) {
      throw new IdentityStorageError('Unable to load blockchain identity.', {
        code: 'BLOCKCHAIN_IDENTITY_LOAD_FAILED',
        cause: error
      });
    }
  }

  async save(identity) {
    const normalized = DeviceIdentity.normalize(identity, this.deviceType).toJSON();
    if (!this.filePath) {
      this.memoryIdentity = normalized;
      return normalized;
    }
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
      const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
      fs.renameSync(tempPath, this.filePath);
      try { fs.chmodSync(this.filePath, 0o600); } catch (_) {}
      return normalized;
    } catch (error) {
      throw new IdentityStorageError('Unable to save blockchain identity.', {
        code: 'BLOCKCHAIN_IDENTITY_SAVE_FAILED',
        cause: error
      });
    }
  }

  async clear() {
    this.memoryIdentity = null;
    if (!this.filePath) return true;
    try {
      if (fs.existsSync(this.filePath)) fs.rmSync(this.filePath, { force: true });
      return true;
    } catch (error) {
      throw new IdentityStorageError('Unable to clear blockchain identity.', {
        code: 'BLOCKCHAIN_IDENTITY_CLEAR_FAILED',
        cause: error
      });
    }
  }
}

module.exports = LocalIdentityStore;
