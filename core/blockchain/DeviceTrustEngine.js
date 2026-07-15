'use strict';

const EventEmitter = require('events');
const DeviceTrust = require('./DeviceTrust');
const BLOCKCHAIN_EVENTS = require('./BlockchainEvents');
const { TRUST_STATUS, TRUST_DECISION, TRUST_SOURCE } = require('./TrustConstants');

class DeviceTrustEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = options.config || {};
    this.trustConfig = this.config.trust || {};
    this.manager = options.manager;
    this.cache = options.cache;
    this.logger = options.logger || console;
    this.refreshTimer = null;
  }

  checkTrust(input = {}) {
    const deviceId = String(input.deviceId || input.sourceDeviceId || input.destinationDeviceId || '').trim();
    const walletAddress = String(input.walletAddress || '').trim();
    const operation = String(input.operation || 'communication').trim();
    this.emit(BLOCKCHAIN_EVENTS.TRUST_CHECK_STARTED, { deviceId, operation });
    if (!this.trustConfig.enabled) return decision(TRUST_DECISION.ALLOW, TRUST_STATUS.TRUSTED, 'trust-disabled');
    const cached = deviceId ? this.cache.get(deviceId) : null;
    if (!cached) {
      if (!this.trustConfig.registryAddress && this.trustConfig.allowUnknownWhenNoRegistry !== false && this.trustConfig.strict !== true) {
        return decision(TRUST_DECISION.ALLOW, TRUST_STATUS.UNKNOWN, 'unknown-allowed-no-registry');
      }
      return decision(TRUST_DECISION.PENDING, TRUST_STATUS.UNKNOWN, 'unknown-device');
    }
    const trust = DeviceTrust.normalize(cached);
    if (trust.trustStatus === TRUST_STATUS.BLOCKED) {
      this.emit(BLOCKCHAIN_EVENTS.TRUST_BLOCKED, trust.toJSON());
      return decision(TRUST_DECISION.BLOCKED, TRUST_STATUS.BLOCKED, 'blocked-device', trust);
    }
    if (trust.trustStatus === TRUST_STATUS.REVOKED) {
      this.emit(BLOCKCHAIN_EVENTS.TRUST_REVOKED, trust.toJSON());
      return decision(TRUST_DECISION.DENY, TRUST_STATUS.REVOKED, 'revoked-device', trust);
    }
    if (trust.isExpired()) {
      this.emit(BLOCKCHAIN_EVENTS.TRUST_EXPIRED, trust.toJSON());
      if (this.trustConfig.offlinePolicy === 'allow-expired-cache' && trust.trustStatus === TRUST_STATUS.TRUSTED) {
        return decision(TRUST_DECISION.ALLOW, TRUST_STATUS.EXPIRED, 'expired-cache-allowed', trust);
      }
      return decision(TRUST_DECISION.PENDING, TRUST_STATUS.EXPIRED, 'trust-expired', trust);
    }
    if (trust.trustStatus === TRUST_STATUS.TRUSTED) {
      if (walletAddress && trust.walletAddress && trust.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return decision(TRUST_DECISION.DENY, TRUST_STATUS.UNKNOWN, 'wallet-mismatch', trust);
      }
      return decision(TRUST_DECISION.ALLOW, TRUST_STATUS.TRUSTED, 'trusted-cache', trust);
    }
    if (trust.trustStatus === TRUST_STATUS.PENDING) return decision(TRUST_DECISION.PENDING, TRUST_STATUS.PENDING, 'pending-trust', trust);
    return decision(TRUST_DECISION.PENDING, TRUST_STATUS.UNKNOWN, 'unknown-trust', trust);
  }

  async refreshTrust(input = {}) {
    const deviceId = String(input.deviceId || input.sourceDeviceId || input.destinationDeviceId || '').trim();
    if (!deviceId) return null;
    const refreshed = await this.manager.refreshTrust(deviceId, { allowCacheOnFailure: true });
    this.emit(BLOCKCHAIN_EVENTS.TRUST_REFRESHED, refreshed);
    return refreshed;
  }

  async verifyTrust(input = {}) {
    const verified = await this.manager.verifyTrust(input);
    this.emit(BLOCKCHAIN_EVENTS.TRUST_VERIFIED, verified);
    return verified;
  }

  async synchronizeTrust() {
    return this.manager.synchronizeTrust();
  }

  startBackgroundRefresh() {
    this.stopBackgroundRefresh();
    const interval = Number(this.trustConfig.backgroundRefreshMs) || 0;
    if (interval <= 0) return;
    this.refreshTimer = setInterval(() => {
      this.synchronizeTrust().catch(error => {
        this.logger.warn?.('Trust background synchronization failed', { error: error.message });
      });
    }, interval);
    this.refreshTimer.unref?.();
  }

  stopBackgroundRefresh() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = null;
  }

  async shutdown() {
    this.stopBackgroundRefresh();
    this.removeAllListeners();
  }
}

function decision(decisionValue, trustStatus, reason, trust = null) {
  return {
    decision: decisionValue,
    allowed: decisionValue === TRUST_DECISION.ALLOW,
    trustStatus,
    reason,
    source: trust?.source || TRUST_SOURCE.CACHE,
    trust: trust?.toJSON?.() || trust || null
  };
}

module.exports = DeviceTrustEngine;
