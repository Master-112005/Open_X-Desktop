'use strict';

const { ethers } = require('ethers');
const ABI = require('./IdentityRegistryAbi');
const { RegistrationError, VerificationError, ConfigurationError } = require('../BlockchainErrors');

class IdentityRegistryClient {
  constructor(options = {}) {
    this.address = String(options.address || '').trim();
    this.client = options.client || null;
    this.logger = options.logger || console;
    this.ContractClass = options.ContractClass || ethers.Contract;
  }

  isConfigured() {
    return Boolean(this.address);
  }

  assertConfigured() {
    if (!this.isConfigured()) {
      throw new ConfigurationError('Identity registry contract address is not configured.', {
        code: 'BLOCKCHAIN_IDENTITY_REGISTRY_NOT_CONFIGURED'
      });
    }
  }

  createContract(signerOrProvider) {
    this.assertConfigured();
    return new this.ContractClass(this.address, ABI, signerOrProvider);
  }

  async register(identity, wallet) {
    try {
      const contract = this.createContract(wallet);
      const tx = await contract.registerDevice(identity.deviceId, identity.deviceType, identity.version);
      const receipt = await tx.wait();
      return {
        transactionHash: receipt?.hash || tx?.hash || '',
        blockNumber: receipt?.blockNumber ?? null,
        registeredAt: new Date().toISOString()
      };
    } catch (error) {
      throw new RegistrationError('Blockchain identity registration failed.', {
        code: 'BLOCKCHAIN_IDENTITY_REGISTRATION_FAILED',
        cause: error,
        details: { deviceId: identity?.deviceId, address: this.address }
      });
    }
  }

  async exists(deviceId) {
    try {
      const contract = this.createContract(this.client.getInternalProvider());
      return Boolean(await contract.deviceExists(deviceId));
    } catch (error) {
      throw new VerificationError('Blockchain identity existence check failed.', {
        code: 'BLOCKCHAIN_IDENTITY_EXISTS_FAILED',
        cause: error,
        details: { deviceId, address: this.address }
      });
    }
  }

  async verify(identity) {
    try {
      const contract = this.createContract(this.client.getInternalProvider());
      return Boolean(await contract.verifyDevice(identity.deviceId, identity.walletAddress));
    } catch (error) {
      throw new VerificationError('Blockchain identity verification failed.', {
        code: 'BLOCKCHAIN_IDENTITY_VERIFICATION_FAILED',
        cause: error,
        details: { deviceId: identity?.deviceId, address: this.address }
      });
    }
  }

  async get(deviceId) {
    try {
      const contract = this.createContract(this.client.getInternalProvider());
      const record = await contract.getDevice(deviceId);
      return normalizeContractDevice(record);
    } catch (error) {
      throw new VerificationError('Blockchain identity lookup failed.', {
        code: 'BLOCKCHAIN_IDENTITY_LOOKUP_FAILED',
        cause: error,
        details: { deviceId, address: this.address }
      });
    }
  }
}

function normalizeContractDevice(record = {}) {
  const statusValue = Number(record.status ?? record[4] ?? 0);
  const registeredAtSeconds = Number(record.registeredAt ?? record[2] ?? 0);
  const revokedAtSeconds = Number(record.revokedAt ?? record[7] ?? 0);
  return {
    deviceId: String(record.deviceId ?? record[0] ?? ''),
    walletAddress: String(record.walletAddress ?? record[1] ?? ''),
    registeredAt: registeredAtSeconds > 0 ? new Date(registeredAtSeconds * 1000).toISOString() : null,
    deviceType: String(record.deviceType ?? record[3] ?? ''),
    status: statusValue === 2 ? 'REVOKED' : statusValue === 1 ? 'REGISTERED' : 'UNKNOWN',
    blockchainVersion: String(record.blockchainVersion ?? record[5] ?? ''),
    identityVersion: String(record.identityVersion ?? record[6] ?? ''),
    revokedAt: revokedAtSeconds > 0 ? new Date(revokedAtSeconds * 1000).toISOString() : null
  };
}

module.exports = IdentityRegistryClient;
