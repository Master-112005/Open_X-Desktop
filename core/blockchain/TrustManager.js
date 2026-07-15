'use strict';

const EventEmitter = require('events');
const DeviceTrust = require('./DeviceTrust');
const DeviceTrustRegistryClient = require('./contracts/DeviceTrustRegistryClient');
const BLOCKCHAIN_EVENTS = require('./BlockchainEvents');
const { TRUST_STATUS, TRUST_SOURCE } = require('./TrustConstants');
const { TrustSyncError, wrapBlockchainError } = require('./BlockchainErrors');

class TrustManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = options.config || {};
    this.trustConfig = this.config.trust || {};
    this.cache = options.cache;
    this.walletManager = options.walletManager || null;
    this.registryClient = options.registryClient || new DeviceTrustRegistryClient({
      address: this.trustConfig.registryAddress,
      client: options.client
    });
    this.logger = options.logger || console;
  }

  async loadTrust() {
    return this.cache.load();
  }

  async cacheTrust(record) {
    const trust = DeviceTrust.normalize({
      ...record,
      expiresAt: record.expiresAt || new Date(Date.now() + Number(this.trustConfig.cacheTtlMs || 86400000)).toISOString(),
      network: record.network || this.config.network
    });
    const saved = await this.cache.set(trust);
    this.emit(BLOCKCHAIN_EVENTS.TRUST_CACHE_UPDATED, saved);
    return saved;
  }

  async refreshTrust(deviceId, options = {}) {
    const id = String(deviceId || '').trim();
    if (!id) return null;
    if (!this.registryClient.isConfigured()) {
      return this.cache.get(id);
    }
    try {
      const chainTrust = await this.registryClient.getTrust(id);
      const saved = await this.cacheTrust({
        ...chainTrust,
        network: this.config.network,
        source: TRUST_SOURCE.BLOCKCHAIN
      });
      this.emit(BLOCKCHAIN_EVENTS.TRUST_REFRESHED, saved);
      return saved;
    } catch (error) {
      if (options.allowCacheOnFailure !== false) return this.cache.get(id);
      throw wrapBlockchainError(error, TrustSyncError, { deviceId: id });
    }
  }

  async verifyTrust(input = {}) {
    const deviceId = String(input.deviceId || '').trim();
    const walletAddress = String(input.walletAddress || '').trim();
    const cached = this.cache.get(deviceId);
    if (cached && !DeviceTrust.normalize(cached).isExpired()) {
      this.emit(BLOCKCHAIN_EVENTS.TRUST_VERIFIED, cached);
      return cached;
    }
    if (this.registryClient.isConfigured() && walletAddress) {
      const valid = await this.registryClient.verifyTrust(deviceId, walletAddress);
      const saved = await this.cacheTrust({
        deviceId,
        walletAddress,
        trustStatus: valid ? TRUST_STATUS.TRUSTED : TRUST_STATUS.PENDING,
        lastVerified: new Date().toISOString(),
        source: TRUST_SOURCE.BLOCKCHAIN
      });
      this.emit(BLOCKCHAIN_EVENTS.TRUST_VERIFIED, saved);
      return saved;
    }
    return cached || await this.cacheTrust({
      deviceId,
      walletAddress,
      trustStatus: TRUST_STATUS.UNKNOWN,
      source: TRUST_SOURCE.DEFAULT
    });
  }

  async invalidateTrust(deviceId) {
    const invalidated = await this.cache.invalidate(deviceId);
    if (invalidated) this.emit(BLOCKCHAIN_EVENTS.TRUST_EXPIRED, invalidated);
    return invalidated;
  }

  async synchronizeTrust() {
    await this.cache.load();
    const records = this.cache.list();
    const refreshed = [];
    for (const record of records) {
      if (DeviceTrust.normalize(record).isExpired()) {
        this.emit(BLOCKCHAIN_EVENTS.TRUST_EXPIRED, record);
        refreshed.push(await this.refreshTrust(record.deviceId, { allowCacheOnFailure: true }));
      }
    }
    this.emit(BLOCKCHAIN_EVENTS.TRUST_SYNCED, { count: refreshed.filter(Boolean).length });
    return this.cache.list();
  }

  async updateTrust(record) {
    const trust = DeviceTrust.normalize(record);
    let chain = {};
    if (this.registryClient.isConfigured() && this.walletManager?.getSigner) {
      chain = await this.registryClient.setTrust(trust, this.walletManager.getSigner());
    }
    return this.cacheTrust(trust.with({
      transactionHash: chain.transactionHash || trust.transactionHash,
      blockNumber: chain.blockNumber ?? trust.blockNumber,
      source: chain.transactionHash ? TRUST_SOURCE.BLOCKCHAIN : trust.source
    }));
  }

  async shutdown() {
    await this.cache.flush();
    this.removeAllListeners();
  }
}

module.exports = TrustManager;
