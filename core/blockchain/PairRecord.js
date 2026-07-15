'use strict';

const { PAIR_STATUS, PAIR_VERSION } = require('./PairConstants');

class PairRecord {
  constructor(options = {}) {
    this.pairId = String(options.pairId || '').trim();
    this.pairHash = String(options.pairHash || '').trim();
    this.desktopDeviceId = String(options.desktopDeviceId || '').trim();
    this.phoneDeviceId = String(options.phoneDeviceId || '').trim();
    this.desktopWallet = String(options.desktopWallet || '').trim();
    this.phoneWallet = String(options.phoneWallet || '').trim();
    this.status = normalizeStatus(options.status);
    this.createdAt = normalizeTimestamp(options.createdAt);
    this.approvedAt = normalizeTimestamp(options.approvedAt);
    this.expiresAt = normalizeTimestamp(options.expiresAt);
    this.transactionHash = String(options.transactionHash || '').trim();
    this.blockNumber = normalizeNumber(options.blockNumber);
    this.version = String(options.version || PAIR_VERSION).trim();
    this.network = String(options.network || '').trim();
    this.nonce = String(options.nonce || '').trim();
  }

  with(update = {}) {
    return new PairRecord({ ...this.toJSON(), ...update });
  }

  isExpired(now = Date.now()) {
    const expiresAt = this.expiresAt ? Date.parse(this.expiresAt) : 0;
    return expiresAt > 0 && expiresAt <= now;
  }

  toJSON() {
    return {
      pairId: this.pairId,
      pairHash: this.pairHash,
      desktopDeviceId: this.desktopDeviceId,
      phoneDeviceId: this.phoneDeviceId,
      desktopWallet: this.desktopWallet,
      phoneWallet: this.phoneWallet,
      status: this.status,
      createdAt: this.createdAt,
      approvedAt: this.approvedAt,
      expiresAt: this.expiresAt,
      transactionHash: this.transactionHash,
      blockNumber: this.blockNumber,
      version: this.version,
      network: this.network,
      nonce: this.nonce
    };
  }

  static normalize(value = {}) {
    return new PairRecord(value && typeof value === 'object' ? value : {});
  }
}

function normalizeStatus(value) {
  const candidate = String(value || '').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(PAIR_STATUS, candidate)
    ? PAIR_STATUS[candidate]
    : PAIR_STATUS.FAILED;
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

module.exports = PairRecord;
