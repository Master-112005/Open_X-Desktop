'use strict';

const crypto = require('crypto');
const { PERMISSION_STATUS, PERMISSION_VERSION } = require('./PermissionConstants');

class PermissionRecord {
  constructor(input = {}) {
    const now = new Date().toISOString();
    this.permissionId = String(input.permissionId || buildPermissionId(input.deviceId, input.permissionName)).trim();
    this.deviceId = String(input.deviceId || '').trim();
    this.walletAddress = String(input.walletAddress || '').trim();
    this.permissionName = normalizePermissionName(input.permissionName || input.name);
    this.status = normalizeStatus(input.status || input.permissionStatus);
    this.grantedBy = String(input.grantedBy || '').trim();
    this.createdAt = normalizeDate(input.createdAt) || now;
    this.updatedAt = normalizeDate(input.updatedAt) || now;
    this.lastVerified = normalizeDate(input.lastVerified) || this.updatedAt;
    this.expiresAt = normalizeDate(input.expiresAt);
    this.transactionHash = String(input.transactionHash || '').trim();
    this.blockNumber = Number.isFinite(Number(input.blockNumber)) ? Number(input.blockNumber) : null;
    this.version = String(input.version || PERMISSION_VERSION);
    this.source = String(input.source || 'cache');
  }

  isExpired(now = Date.now()) {
    if (this.status === PERMISSION_STATUS.EXPIRED) return true;
    if (!this.expiresAt) return false;
    const expires = Date.parse(this.expiresAt);
    return Number.isFinite(expires) && expires <= now;
  }

  with(patch = {}) {
    return new PermissionRecord({ ...this.toJSON(), ...patch });
  }

  toJSON() {
    return {
      permissionId: this.permissionId,
      deviceId: this.deviceId,
      walletAddress: this.walletAddress,
      permissionName: this.permissionName,
      status: this.status,
      grantedBy: this.grantedBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastVerified: this.lastVerified,
      expiresAt: this.expiresAt,
      transactionHash: this.transactionHash,
      blockNumber: this.blockNumber,
      version: this.version,
      source: this.source
    };
  }

  static normalize(input = {}) {
    return input instanceof PermissionRecord ? input : new PermissionRecord(input);
  }
}

function buildPermissionId(deviceId, permissionName) {
  const key = `${String(deviceId || '').trim()}:${normalizePermissionName(permissionName)}`;
  if (key === ':') return '';
  return crypto.createHash('sha256').update(key).digest('hex');
}

function normalizePermissionName(value) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[^a-zA-Z0-9._:-]/g, '')
    .trim();
}

function normalizeStatus(status) {
  const normalized = String(status || '').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(PERMISSION_STATUS, normalized)
    ? PERMISSION_STATUS[normalized]
    : PERMISSION_STATUS.UNKNOWN;
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

module.exports = PermissionRecord;
