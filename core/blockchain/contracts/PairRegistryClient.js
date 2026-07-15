'use strict';

const { ethers } = require('ethers');
const ABI = require('./PairRegistryAbi');
const { PairError, PairVerificationError, PairSynchronizationError, ConfigurationError } = require('../BlockchainErrors');

class PairRegistryClient {
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
      throw new ConfigurationError('Pair registry contract address is not configured.', {
        code: 'BLOCKCHAIN_PAIR_REGISTRY_NOT_CONFIGURED'
      });
    }
  }

  createContract(signerOrProvider) {
    this.assertConfigured();
    return new this.ContractClass(this.address, ABI, signerOrProvider);
  }

  async createPair(pair, signer) {
    try {
      const contract = this.createContract(signer);
      const expiresAtSeconds = Math.floor(Date.parse(pair.expiresAt) / 1000);
      const tx = await contract.createPair(pair.pairHash, pair.desktopDeviceId, pair.desktopWallet, expiresAtSeconds, pair.version);
      const receipt = await tx.wait();
      return { transactionHash: receipt?.hash || tx?.hash || '', blockNumber: receipt?.blockNumber ?? null };
    } catch (error) {
      throw new PairError('Blockchain pair creation failed.', {
        code: 'BLOCKCHAIN_PAIR_CREATE_FAILED',
        cause: error,
        details: { pairId: pair?.pairId }
      });
    }
  }

  async approvePair(pair, signer) {
    try {
      const contract = this.createContract(signer);
      const tx = await contract.approvePair(pair.pairHash, pair.phoneDeviceId, pair.phoneWallet);
      const receipt = await tx.wait();
      return { transactionHash: receipt?.hash || tx?.hash || '', blockNumber: receipt?.blockNumber ?? null };
    } catch (error) {
      throw new PairError('Blockchain pair approval failed.', {
        code: 'BLOCKCHAIN_PAIR_APPROVE_FAILED',
        cause: error,
        details: { pairId: pair?.pairId }
      });
    }
  }

  async rejectPair(pairHash, signer) {
    return this.writeStatus('rejectPair', pairHash, signer, 'BLOCKCHAIN_PAIR_REJECT_FAILED');
  }

  async revokePair(pairHash, signer) {
    return this.writeStatus('revokePair', pairHash, signer, 'BLOCKCHAIN_PAIR_REVOKE_FAILED');
  }

  async writeStatus(method, pairHash, signer, code) {
    try {
      const contract = this.createContract(signer);
      const tx = await contract[method](pairHash);
      const receipt = await tx.wait();
      return { transactionHash: receipt?.hash || tx?.hash || '', blockNumber: receipt?.blockNumber ?? null };
    } catch (error) {
      throw new PairError('Blockchain pair status update failed.', { code, cause: error });
    }
  }

  async pairExists(pairHash) {
    try {
      return Boolean(await this.createContract(this.client.getInternalProvider()).pairExists(pairHash));
    } catch (error) {
      throw new PairVerificationError('Blockchain pair existence check failed.', {
        code: 'BLOCKCHAIN_PAIR_EXISTS_FAILED',
        cause: error
      });
    }
  }

  async getPair(pairHash) {
    try {
      return normalizeContractPair(await this.createContract(this.client.getInternalProvider()).getPair(pairHash));
    } catch (error) {
      throw new PairSynchronizationError('Blockchain pair lookup failed.', {
        code: 'BLOCKCHAIN_PAIR_LOOKUP_FAILED',
        cause: error
      });
    }
  }

  async getStatus(pairHash) {
    try {
      return statusFromNumber(Number(await this.createContract(this.client.getInternalProvider()).getStatus(pairHash)));
    } catch (error) {
      throw new PairSynchronizationError('Blockchain pair status lookup failed.', {
        code: 'BLOCKCHAIN_PAIR_STATUS_FAILED',
        cause: error
      });
    }
  }
}

function normalizeContractPair(record = {}) {
  const createdAt = Number(record.createdAt ?? record[6] ?? 0);
  const approvedAt = Number(record.approvedAt ?? record[7] ?? 0);
  const expiresAt = Number(record.expiresAt ?? record[8] ?? 0);
  return {
    pairHash: String(record.pairHash ?? record[0] ?? ''),
    desktopDeviceId: String(record.desktopDeviceId ?? record[1] ?? ''),
    phoneDeviceId: String(record.phoneDeviceId ?? record[2] ?? ''),
    desktopWallet: String(record.desktopWallet ?? record[3] ?? ''),
    phoneWallet: String(record.phoneWallet ?? record[4] ?? ''),
    status: statusFromNumber(Number(record.status ?? record[5] ?? 0)),
    createdAt: createdAt ? new Date(createdAt * 1000).toISOString() : null,
    approvedAt: approvedAt ? new Date(approvedAt * 1000).toISOString() : null,
    expiresAt: expiresAt ? new Date(expiresAt * 1000).toISOString() : null,
    version: String(record.version ?? record[9] ?? '')
  };
}

function statusFromNumber(value) {
  return ['PENDING', 'WAITING_APPROVAL', 'APPROVED', 'REJECTED', 'EXPIRED', 'REVOKED', 'FAILED'][value] || 'FAILED';
}

module.exports = PairRegistryClient;
