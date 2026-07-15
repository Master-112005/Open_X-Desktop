'use strict';

const { IDENTITY_STATUS, IDENTITY_VERSION } = require('./IdentityConstants');

class DeviceIdentity {
  constructor(options = {}) {
    this.deviceId = String(options.deviceId || '').trim();
    this.walletAddress = String(options.walletAddress || '').trim();
    this.deviceType = String(options.deviceType || 'desktop').trim().toLowerCase();
    this.registeredAt = normalizeTimestamp(options.registeredAt);
    this.status = normalizeStatus(options.status);
    this.network = String(options.network || '').trim();
    this.version = String(options.version || IDENTITY_VERSION).trim();
    this.transactionHash = String(options.transactionHash || '').trim();
    this.blockNumber = normalizeNumber(options.blockNumber);
    this.lastVerified = normalizeTimestamp(options.lastVerified);
  }

  with(update = {}) {
    return new DeviceIdentity({ ...this.toJSON(), ...update });
  }

  toJSON() {
    return {
      deviceId: this.deviceId,
      walletAddress: this.walletAddress,
      deviceType: this.deviceType,
      registeredAt: this.registeredAt,
      status: this.status,
      network: this.network,
      version: this.version,
      transactionHash: this.transactionHash,
      blockNumber: this.blockNumber,
      lastVerified: this.lastVerified
    };
  }

  static empty(deviceType = 'desktop') {
    return new DeviceIdentity({
      deviceType,
      status: IDENTITY_STATUS.UNKNOWN
    });
  }

  static normalize(value = {}, fallbackDeviceType = 'desktop') {
    if (!value || typeof value !== 'object') return DeviceIdentity.empty(fallbackDeviceType);
    return new DeviceIdentity({
      ...value,
      deviceType: value.deviceType || fallbackDeviceType
    });
  }
}

function normalizeStatus(value) {
  const candidate = String(value || '').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(IDENTITY_STATUS, candidate)
    ? IDENTITY_STATUS[candidate]
    : IDENTITY_STATUS.UNKNOWN;
}

function normalizeTimestamp(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

module.exports = DeviceIdentity;
