'use strict';

const path = require('path');
const { ensureDataRoot, readJsonFile, writeJsonAtomic } = require('../Data');

class DeviceRegistry {
  constructor(options = {}) {
    this.config = options.config || {};
    const paths = ensureDataRoot(this.config);
    this.filePath = path.resolve(options.filePath || paths.homeLearningDeviceRegistryPath);
  }

  upsert(device = {}) {
    const data = this._read();
    const deviceId = String(device.deviceId || '').trim().toLowerCase();
    if (!deviceId) return null;
    const existing = data.devices[deviceId] || {};
    const now = new Date().toISOString();
    const record = {
      deviceId,
      name: String(device.name || device.deviceName || existing.name || deviceId).trim(),
      type: String(device.type || device.deviceType || existing.type || 'device').trim().toLowerCase(),
      room: String(device.room || existing.room || 'unknown').trim().toLowerCase(),
      capabilities: Array.isArray(device.capabilities) ? device.capabilities.slice(0, 20) : existing.capabilities || [],
      manufacturer: device.manufacturer || existing.manufacturer || null,
      model: device.model || existing.model || null,
      enabledForLearning: device.enabledForLearning !== false && existing.enabledForLearning !== false,
      createdAt: existing.createdAt || now,
      updatedAt: now
    };
    data.devices[deviceId] = record;
    data.metadata.updatedAt = now;
    writeJsonAtomic(this.filePath, data, { backup: true });
    return record;
  }

  get(deviceId) {
    return this._read().devices[String(deviceId || '').trim().toLowerCase()] || null;
  }

  list() {
    return Object.values(this._read().devices);
  }

  _read() {
    return readJsonFile(this.filePath, () => ({
      version: 1,
      devices: {},
      metadata: { updatedAt: null }
    }), {
      createIfMissing: true,
      validate: value => value && value.version === 1 && value.devices && typeof value.devices === 'object'
    });
  }
}

module.exports = DeviceRegistry;
