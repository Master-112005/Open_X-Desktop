'use strict';

const path = require('path');
const {
  ensureDataRoot,
  readSecureJsonFile,
  writeSecureJsonAtomic
} = require('../../../assistant/Data');

/**
 * Disk-backed record of this install's paired ("connected") Home Devices,
 * stored encrypted under OpenX_Data so the Connected Devices list survives
 * app restarts even if OpenX_Server's in-memory registry has been cleared.
 * Nearby/unpaired discovery devices are never persisted here - only devices
 * the user has actually paired.
 */
class HomeDeviceStore {
  constructor(options = {}) {
    this.config = options.config || {};
    const paths = options.dataPaths || ensureDataRoot(this.config);
    this.filePath = path.resolve(options.filePath || paths.homeDevicesPath);
    this.keyPath = options.keyPath || paths.dataEncryptionKeyPath;
  }

  list() {
    return Object.values(this._read().devices);
  }

  upsert(device = {}) {
    const deviceId = String(device.deviceId || '').trim();
    if (!deviceId) return null;
    const data = this._read();
    const record = { ...data.devices[deviceId], ...device, deviceId };
    data.devices[deviceId] = record;
    this._write(data);
    return record;
  }

  rename(deviceId, deviceName) {
    const normalizedId = String(deviceId || '').trim();
    const data = this._read();
    const existing = data.devices[normalizedId];
    if (!existing) return null;
    existing.deviceName = deviceName;
    existing.updatedAt = new Date().toISOString();
    this._write(data);
    return existing;
  }

  remove(deviceId) {
    const normalizedId = String(deviceId || '').trim();
    const data = this._read();
    if (!data.devices[normalizedId]) return false;
    delete data.devices[normalizedId];
    this._write(data);
    return true;
  }

  _read() {
    return readSecureJsonFile(this.filePath, () => ({ version: 1, devices: {} }), {
      createIfMissing: true,
      config: this.config,
      keyPath: this.keyPath,
      validate: value => value && value.version === 1 && value.devices && typeof value.devices === 'object'
    });
  }

  _write(data) {
    writeSecureJsonAtomic(this.filePath, data, { backup: true, config: this.config, keyPath: this.keyPath });
  }
}

module.exports = HomeDeviceStore;
