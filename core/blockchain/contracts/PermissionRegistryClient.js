'use strict';

const { ethers } = require('ethers');
const ABI = require('./PermissionRegistryAbi');
const {
  BlockchainPermissionError,
  PermissionVerificationError,
  ConfigurationError
} = require('../BlockchainErrors');
const { PERMISSION_STATUS } = require('../PermissionConstants');

class PermissionRegistryClient {
  constructor(options = {}) {
    this.address = String(options.address || '').trim();
    this.client = options.client || null;
    this.ContractClass = options.ContractClass || ethers.Contract;
  }

  isConfigured() {
    return Boolean(this.address);
  }

  assertConfigured() {
    if (!this.isConfigured()) {
      throw new ConfigurationError('Permission registry contract address is not configured.', {
        code: 'BLOCKCHAIN_PERMISSION_REGISTRY_NOT_CONFIGURED'
      });
    }
  }

  createContract(signerOrProvider) {
    this.assertConfigured();
    return new this.ContractClass(this.address, ABI, signerOrProvider);
  }

  async grantPermission(record, signer) {
    try {
      const tx = await this.createContract(signer).grantPermission(
        record.deviceId,
        record.walletAddress,
        record.permissionName,
        statusToNumber(record.status),
        toUnix(record.expiresAt),
        record.version
      );
      const receipt = await tx.wait();
      return { transactionHash: receipt?.hash || tx?.hash || '', blockNumber: receipt?.blockNumber ?? null };
    } catch (error) {
      throw new BlockchainPermissionError('Blockchain permission grant failed.', {
        code: 'BLOCKCHAIN_PERMISSION_GRANT_FAILED',
        cause: error,
        details: { deviceId: record?.deviceId, permissionName: record?.permissionName }
      });
    }
  }

  async removePermission(deviceId, permissionName, signer) {
    try {
      const tx = await this.createContract(signer).removePermission(deviceId, permissionName);
      const receipt = await tx.wait();
      return { transactionHash: receipt?.hash || tx?.hash || '', blockNumber: receipt?.blockNumber ?? null };
    } catch (error) {
      throw new BlockchainPermissionError('Blockchain permission removal failed.', {
        code: 'BLOCKCHAIN_PERMISSION_REMOVE_FAILED',
        cause: error,
        details: { deviceId, permissionName }
      });
    }
  }

  async updatePermission(record, signer) {
    try {
      const tx = await this.createContract(signer).updatePermission(
        record.deviceId,
        record.walletAddress,
        record.permissionName,
        statusToNumber(record.status),
        toUnix(record.expiresAt),
        record.version
      );
      const receipt = await tx.wait();
      return { transactionHash: receipt?.hash || tx?.hash || '', blockNumber: receipt?.blockNumber ?? null };
    } catch (error) {
      throw new BlockchainPermissionError('Blockchain permission update failed.', {
        code: 'BLOCKCHAIN_PERMISSION_UPDATE_FAILED',
        cause: error,
        details: { deviceId: record?.deviceId, permissionName: record?.permissionName }
      });
    }
  }

  async checkPermission(deviceId, permissionName) {
    try {
      return Boolean(await this.createContract(this.client.getInternalProvider()).checkPermission(deviceId, permissionName));
    } catch (error) {
      throw new PermissionVerificationError('Blockchain permission check failed.', {
        code: 'BLOCKCHAIN_PERMISSION_CHECK_FAILED',
        cause: error,
        details: { deviceId, permissionName }
      });
    }
  }

  async permissionExists(deviceId, permissionName) {
    try {
      return Boolean(await this.createContract(this.client.getInternalProvider()).permissionExists(deviceId, permissionName));
    } catch (error) {
      throw new BlockchainPermissionError('Blockchain permission existence check failed.', {
        code: 'BLOCKCHAIN_PERMISSION_EXISTS_FAILED',
        cause: error,
        details: { deviceId, permissionName }
      });
    }
  }

  async getPermission(deviceId, permissionName) {
    try {
      return normalizePermission(await this.createContract(this.client.getInternalProvider()).getPermission(deviceId, permissionName));
    } catch (error) {
      throw new BlockchainPermissionError('Blockchain permission lookup failed.', {
        code: 'BLOCKCHAIN_PERMISSION_LOOKUP_FAILED',
        cause: error,
        details: { deviceId, permissionName }
      });
    }
  }

  async listPermissions(deviceId) {
    try {
      return Array.from(await this.createContract(this.client.getInternalProvider()).listPermissions(deviceId));
    } catch (error) {
      throw new BlockchainPermissionError('Blockchain permission list failed.', {
        code: 'BLOCKCHAIN_PERMISSION_LIST_FAILED',
        cause: error,
        details: { deviceId }
      });
    }
  }
}

function normalizePermission(record = {}) {
  const createdAt = Number(record.createdAt ?? record[6] ?? 0);
  const updatedAt = Number(record.updatedAt ?? record[7] ?? 0);
  const expiresAt = Number(record.expiresAt ?? record[8] ?? 0);
  return {
    permissionId: String(record.permissionId ?? record[0] ?? ''),
    deviceId: String(record.deviceId ?? record[1] ?? ''),
    walletAddress: String(record.walletAddress ?? record[2] ?? ''),
    permissionName: String(record.permissionName ?? record[3] ?? ''),
    status: statusFromNumber(Number(record.status ?? record[4] ?? 0)),
    grantedBy: String(record.grantedBy ?? record[5] ?? ''),
    createdAt: createdAt ? new Date(createdAt * 1000).toISOString() : null,
    updatedAt: updatedAt ? new Date(updatedAt * 1000).toISOString() : null,
    lastVerified: new Date().toISOString(),
    expiresAt: expiresAt ? new Date(expiresAt * 1000).toISOString() : null,
    source: 'blockchain'
  };
}

function statusToNumber(status) {
  return {
    GRANTED: 0,
    DENIED: 1,
    PENDING: 2,
    REVOKED: 3,
    EXPIRED: 4,
    UNKNOWN: 5
  }[String(status || '').toUpperCase()] ?? 5;
}

function statusFromNumber(status) {
  return [
    PERMISSION_STATUS.GRANTED,
    PERMISSION_STATUS.DENIED,
    PERMISSION_STATUS.PENDING,
    PERMISSION_STATUS.REVOKED,
    PERMISSION_STATUS.EXPIRED,
    PERMISSION_STATUS.UNKNOWN
  ][status] || PERMISSION_STATUS.UNKNOWN;
}

function toUnix(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : 0;
}

module.exports = PermissionRegistryClient;
