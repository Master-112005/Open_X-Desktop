'use strict';

const EventEmitter = require('events');
const PermissionRecord = require('./PermissionRecord');
const PermissionRegistryClient = require('./contracts/PermissionRegistryClient');
const BLOCKCHAIN_EVENTS = require('./BlockchainEvents');
const {
  PERMISSION_STATUS,
  PERMISSION_DECISION,
  PERMISSION_SOURCE
} = require('./PermissionConstants');
const { PermissionSyncError, wrapBlockchainError } = require('./BlockchainErrors');

class PermissionManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.config = options.config || {};
    this.permissionConfig = this.config.permissions || {};
    this.cache = options.cache;
    this.walletManager = options.walletManager || null;
    this.registryClient = options.registryClient || new PermissionRegistryClient({
      address: this.permissionConfig.registryAddress,
      client: options.client
    });
    this.osPermissionProvider = options.osPermissionProvider || defaultOsPermissionProvider;
    this.localPolicyProvider = options.localPolicyProvider || defaultLocalPolicyProvider;
    this.logger = options.logger || console;
    this.refreshTimer = null;
  }

  async loadPermissions() {
    return this.cache.load();
  }

  async cachePermission(record) {
    const permission = PermissionRecord.normalize({
      ...record,
      expiresAt: record.expiresAt || new Date(Date.now() + Number(this.permissionConfig.cacheTtlMs || 86400000)).toISOString()
    });
    const saved = await this.cache.set(permission);
    this.emit(BLOCKCHAIN_EVENTS.PERMISSION_CACHE_UPDATED, saved);
    return saved;
  }

  async grantPermission(record = {}) {
    const permission = PermissionRecord.normalize({
      ...record,
      status: record.status || PERMISSION_STATUS.GRANTED,
      updatedAt: new Date().toISOString()
    });
    let chain = {};
    if (this.registryClient.isConfigured() && this.walletManager?.getSigner) {
      chain = await this.registryClient.grantPermission(permission, this.walletManager.getSigner());
    }
    const saved = await this.cachePermission(permission.with({
      transactionHash: chain.transactionHash || permission.transactionHash,
      blockNumber: chain.blockNumber ?? permission.blockNumber,
      source: chain.transactionHash ? PERMISSION_SOURCE.BLOCKCHAIN : permission.source
    }));
    this.emit(BLOCKCHAIN_EVENTS.PERMISSION_GRANTED, saved);
    return saved;
  }

  async removePermission(input = {}) {
    const deviceId = String(input.deviceId || '').trim();
    const permissionName = String(input.permissionName || input.name || '').trim();
    let chain = {};
    if (this.registryClient.isConfigured() && this.walletManager?.getSigner) {
      chain = await this.registryClient.removePermission(deviceId, permissionName, this.walletManager.getSigner());
    }
    const existing = this.cache.get(deviceId, permissionName) || input;
    const saved = await this.cachePermission({
      ...existing,
      deviceId,
      permissionName,
      status: PERMISSION_STATUS.REVOKED,
      updatedAt: new Date().toISOString(),
      transactionHash: chain.transactionHash || existing.transactionHash,
      blockNumber: chain.blockNumber ?? existing.blockNumber,
      source: chain.transactionHash ? PERMISSION_SOURCE.BLOCKCHAIN : existing.source
    });
    this.emit(BLOCKCHAIN_EVENTS.PERMISSION_REMOVED, saved);
    this.emit(BLOCKCHAIN_EVENTS.PERMISSION_REVOKED, saved);
    return saved;
  }

  async updatePermission(record = {}) {
    const permission = PermissionRecord.normalize({
      ...record,
      updatedAt: new Date().toISOString()
    });
    let chain = {};
    if (this.registryClient.isConfigured() && this.walletManager?.getSigner) {
      chain = await this.registryClient.updatePermission(permission, this.walletManager.getSigner());
    }
    const saved = await this.cachePermission(permission.with({
      transactionHash: chain.transactionHash || permission.transactionHash,
      blockNumber: chain.blockNumber ?? permission.blockNumber,
      source: chain.transactionHash ? PERMISSION_SOURCE.BLOCKCHAIN : permission.source
    }));
    this.emit(BLOCKCHAIN_EVENTS.PERMISSION_UPDATED, saved);
    return saved;
  }

  async refreshPermission(input = {}, options = {}) {
    const deviceId = String(input.deviceId || '').trim();
    const permissionName = String(input.permissionName || input.name || '').trim();
    if (!deviceId || !permissionName) return null;
    if (!this.registryClient.isConfigured()) return this.cache.get(deviceId, permissionName);
    try {
      const chainPermission = await this.registryClient.getPermission(deviceId, permissionName);
      const saved = await this.cachePermission({
        ...chainPermission,
        source: PERMISSION_SOURCE.BLOCKCHAIN
      });
      this.emit(BLOCKCHAIN_EVENTS.PERMISSION_REFRESHED, saved);
      return saved;
    } catch (error) {
      if (options.allowCacheOnFailure !== false) return this.cache.get(deviceId, permissionName);
      throw wrapBlockchainError(error, PermissionSyncError, { deviceId, permissionName });
    }
  }

  async synchronizePermissions() {
    await this.cache.load();
    const refreshed = [];
    for (const record of this.cache.list()) {
      const permission = PermissionRecord.normalize(record);
      if (permission.isExpired()) {
        this.emit(BLOCKCHAIN_EVENTS.PERMISSION_EXPIRED, permission.toJSON());
        refreshed.push(await this.refreshPermission(permission, { allowCacheOnFailure: true }));
      }
    }
    this.emit(BLOCKCHAIN_EVENTS.PERMISSION_SYNCED, { count: refreshed.filter(Boolean).length });
    return this.cache.list();
  }

  async recoverPermission(input = {}) {
    return this.refreshPermission(input, { allowCacheOnFailure: true });
  }

  async expirePermission(input = {}) {
    const expired = await this.cache.invalidate(input.deviceId, input.permissionName || input.name);
    if (expired) this.emit(BLOCKCHAIN_EVENTS.PERMISSION_EXPIRED, expired);
    return expired;
  }

  checkPermission(input = {}) {
    const deviceId = String(input.deviceId || '').trim();
    const permissionName = String(input.permissionName || input.name || input.operation || '').trim();
    const cached = deviceId && permissionName ? this.cache.get(deviceId, permissionName) : null;
    const os = this.osPermissionProvider(input);
    const local = this.localPolicyProvider(input);
    if (os.allowed === false) return buildDecision(PERMISSION_DECISION.BLOCK, PERMISSION_STATUS.DENIED, 'os-permission-denied', cached, os, local);
    if (local.allowed === false) return buildDecision(PERMISSION_DECISION.DENY, PERMISSION_STATUS.DENIED, 'local-policy-denied', cached, os, local);
    if (!this.permissionConfig.enabled) return buildDecision(PERMISSION_DECISION.ALLOW, PERMISSION_STATUS.GRANTED, 'permission-manager-disabled', cached, os, local);
    if (!cached) {
      if (!this.permissionConfig.registryAddress && this.permissionConfig.allowUnknownWhenNoRegistry !== false && this.permissionConfig.strict !== true) {
        return buildDecision(PERMISSION_DECISION.ALLOW, PERMISSION_STATUS.UNKNOWN, 'unknown-allowed-no-registry', cached, os, local);
      }
      return buildDecision(PERMISSION_DECISION.REQUEST, PERMISSION_STATUS.UNKNOWN, 'unknown-permission', cached, os, local);
    }
    const permission = PermissionRecord.normalize(cached);
    if (permission.status === PERMISSION_STATUS.REVOKED) {
      this.emit(BLOCKCHAIN_EVENTS.PERMISSION_REVOKED, permission.toJSON());
      return buildDecision(PERMISSION_DECISION.BLOCK, PERMISSION_STATUS.REVOKED, 'permission-revoked', permission, os, local);
    }
    if (permission.status === PERMISSION_STATUS.DENIED) {
      this.emit(BLOCKCHAIN_EVENTS.PERMISSION_DENIED, permission.toJSON());
      return buildDecision(PERMISSION_DECISION.DENY, PERMISSION_STATUS.DENIED, 'permission-denied', permission, os, local);
    }
    if (permission.isExpired()) {
      this.emit(BLOCKCHAIN_EVENTS.PERMISSION_EXPIRED, permission.toJSON());
      if (this.permissionConfig.offlinePolicy === 'allow-expired-cache' && permission.status === PERMISSION_STATUS.GRANTED) {
        return buildDecision(PERMISSION_DECISION.ALLOW, PERMISSION_STATUS.EXPIRED, 'expired-cache-allowed', permission, os, local);
      }
      return buildDecision(PERMISSION_DECISION.REQUEST, PERMISSION_STATUS.EXPIRED, 'permission-expired', permission, os, local);
    }
    if (permission.status === PERMISSION_STATUS.GRANTED) {
      return buildDecision(PERMISSION_DECISION.ALLOW, PERMISSION_STATUS.GRANTED, 'granted-cache', permission, os, local);
    }
    return buildDecision(PERMISSION_DECISION.REQUEST, permission.status, 'permission-not-granted', permission, os, local);
  }

  async permissionExists(input = {}) {
    const deviceId = String(input.deviceId || '').trim();
    const permissionName = String(input.permissionName || input.name || '').trim();
    if (this.cache.get(deviceId, permissionName)) return true;
    if (!this.registryClient.isConfigured()) return false;
    return this.registryClient.permissionExists(deviceId, permissionName);
  }

  startBackgroundSync() {
    this.stopBackgroundSync();
    const interval = Number(this.permissionConfig.backgroundRefreshMs) || 0;
    if (interval <= 0) return;
    this.refreshTimer = setInterval(() => {
      this.synchronizePermissions().catch(error => {
        this.logger.warn?.('Permission background synchronization failed', { error: error.message });
      });
    }, interval);
    this.refreshTimer.unref?.();
  }

  stopBackgroundSync() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = null;
  }

  async shutdown() {
    this.stopBackgroundSync();
    await this.cache.flush();
    this.removeAllListeners();
  }
}

function buildDecision(decision, status, reason, record = null, os = null, local = null) {
  return {
    decision,
    allowed: decision === PERMISSION_DECISION.ALLOW,
    status,
    permissionStatus: status,
    reason,
    source: record?.source || PERMISSION_SOURCE.CACHE,
    osPermission: os || { allowed: true },
    localPolicy: local || { allowed: true },
    permission: record?.toJSON?.() || record || null
  };
}

function defaultOsPermissionProvider() {
  return { allowed: true, source: PERMISSION_SOURCE.OS };
}

function defaultLocalPolicyProvider(input = {}) {
  const localAllowed = input.localAllowed;
  if (localAllowed === false) return { allowed: false, source: PERMISSION_SOURCE.LOCAL_POLICY };
  return { allowed: true, source: PERMISSION_SOURCE.LOCAL_POLICY };
}

module.exports = PermissionManager;
