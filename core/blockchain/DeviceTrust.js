'use strict';

const { TRUST_STATUS, TRUST_VERSION, TRUST_SOURCE } = require('./TrustConstants');

class DeviceTrust {
  constructor(options = {}) {
    this.deviceId = String(options.deviceId || '').trim();
    this.walletAddress = String(options.walletAddress || '').trim();
    this.trustStatus = normalizeStatus(options.trustStatus || options.status);
    this.lastVerified = normalizeTimestamp(options.lastVerified);
    this.expiresAt = normalizeTimestamp(options.expiresAt);
    this.version = String(options.version || TRUST_VERSION).trim();
    this.network = String(options.network || '').trim();
    this.transactionHash = String(options.transactionHash || '').trim();
    this.blockNumber = normalizeNumber(options.blockNumber);
    this.source = String(options.source || TRUST_SOURCE.CACHE).trim();
  }

  with(update = {}) {
    return new DeviceTrust({ ...this.toJSON(), ...update });
  }

  isExpired(now = Date.now()) {
    const expiresAt = this.expiresAt ? Date.parse(this.expiresAt) : 0;
    return expiresAt > 0 && expiresAt <= now;
  }

  toJSON() {
    return {
      deviceId: this.deviceId,
      walletAddress: this.walletAddress,
      trustStatus: this.trustStatus,
      lastVerified: this.lastVerified,
      expiresAt: this.expiresAt,
      version: this.version,
      network: this.network,
      transactionHash: this.transactionHash,
      blockNumber: this.blockNumber,
      source: this.source
    };
  }

  static normalize(value = {}) {
    return new DeviceTrust(value && typeof value === 'object' ? value : {});
  }
}

function normalizeStatus(value) {
  const candidate = String(value || '').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(TRUST_STATUS, candidate)
    ? TRUST_STATUS[candidate]
    : TRUST_STATUS.UNKNOWN;
}

function normalizeTimestamp(value) {
  if (!value) return null;
  if (Number.isFinite(Number(value))) return new Date(Number(value)).toISOString();
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

module.exports = DeviceTrust;
