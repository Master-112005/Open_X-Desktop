'use strict';

const { ethers } = require('ethers');
const ABI = require('./DeviceTrustRegistryAbi');
const { BlockchainTrustError, TrustVerificationError, ConfigurationError } = require('../BlockchainErrors');

class DeviceTrustRegistryClient {
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
      throw new ConfigurationError('Device trust registry contract address is not configured.', {
        code: 'BLOCKCHAIN_TRUST_REGISTRY_NOT_CONFIGURED'
      });
    }
  }

  createContract(signerOrProvider) {
    this.assertConfigured();
    return new this.ContractClass(this.address, ABI, signerOrProvider);
  }

  async setTrust(record, signer) {
    try {
      const contract = this.createContract(signer);
      const expiresAt = Math.floor(Date.parse(record.expiresAt || new Date(Date.now() + 86400000).toISOString()) / 1000);
      const tx = await contract.setTrust(record.deviceId, record.walletAddress, statusToNumber(record.trustStatus), expiresAt, record.version);
      const receipt = await tx.wait();
      return { transactionHash: receipt?.hash || tx?.hash || '', blockNumber: receipt?.blockNumber ?? null };
    } catch (error) {
      throw new BlockchainTrustError('Blockchain trust update failed.', {
        code: 'BLOCKCHAIN_TRUST_SET_FAILED',
        cause: error,
        details: { deviceId: record?.deviceId }
      });
    }
  }

  async getTrust(deviceId) {
    try {
      return normalizeTrust(await this.createContract(this.client.getInternalProvider()).getTrust(deviceId));
    } catch (error) {
      throw new BlockchainTrustError('Blockchain trust lookup failed.', {
        code: 'BLOCKCHAIN_TRUST_LOOKUP_FAILED',
        cause: error,
        details: { deviceId }
      });
    }
  }

  async verifyTrust(deviceId, walletAddress) {
    try {
      return Boolean(await this.createContract(this.client.getInternalProvider()).verifyTrust(deviceId, walletAddress));
    } catch (error) {
      throw new TrustVerificationError('Blockchain trust verification failed.', {
        code: 'BLOCKCHAIN_TRUST_VERIFY_FAILED',
        cause: error,
        details: { deviceId }
      });
    }
  }

  async trustExists(deviceId) {
    try {
      return Boolean(await this.createContract(this.client.getInternalProvider()).trustExists(deviceId));
    } catch (error) {
      throw new BlockchainTrustError('Blockchain trust existence check failed.', {
        code: 'BLOCKCHAIN_TRUST_EXISTS_FAILED',
        cause: error,
        details: { deviceId }
      });
    }
  }
}

function normalizeTrust(record = {}) {
  const lastVerified = Number(record.lastVerified ?? record[3] ?? 0);
  const expiresAt = Number(record.expiresAt ?? record[4] ?? 0);
  return {
    deviceId: String(record.deviceId ?? record[0] ?? ''),
    walletAddress: String(record.walletAddress ?? record[1] ?? ''),
    trustStatus: statusFromNumber(Number(record.status ?? record[2] ?? 0)),
    lastVerified: lastVerified ? new Date(lastVerified * 1000).toISOString() : null,
    expiresAt: expiresAt ? new Date(expiresAt * 1000).toISOString() : null,
    version: String(record.version ?? record[5] ?? ''),
    source: 'blockchain'
  };
}

function statusToNumber(status) {
  return { TRUSTED: 0, PENDING: 1, BLOCKED: 2, REVOKED: 3, UNKNOWN: 4, EXPIRED: 5 }[String(status || '').toUpperCase()] ?? 4;
}

function statusFromNumber(status) {
  return ['TRUSTED', 'PENDING', 'BLOCKED', 'REVOKED', 'UNKNOWN', 'EXPIRED'][status] || 'UNKNOWN';
}

module.exports = DeviceTrustRegistryClient;
