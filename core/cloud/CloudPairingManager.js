const EventEmitter = require('events');
const QRCode = require('qrcode');
const { generateSecret, encryptJson } = require('./CloudE2EE');

const CLOUD_PAIR_VERSION = 1;
const DEFAULT_TOKEN_TTL_MS = 5 * 60 * 1000;

class CloudPairingManager extends EventEmitter {
  constructor(options = {}) {
    super();
    if (!options.connectionManager) {
      throw new TypeError('CloudPairingManager requires a cloud connection manager');
    }
    this.connectionManager = options.connectionManager;
    this.qrCode = options.qrCode || QRCode;
    this.secureKeyStore = options.secureKeyStore || null;
    this.blockchainService = options.blockchainService || null;
    this.logger = options.logger || console;
    this.now = options.now || (() => Date.now());
    this.tokenTtlMs = Number(options.tokenTtlMs) || DEFAULT_TOKEN_TTL_MS;
    this.currentPairing = null;
    this.pendingRequests = new Map();
    this.pendingSecureApprovals = new Map();

    this.boundPairingRequest = request => this.handlePairingRequest(request);
    this.boundPairingResult = result => this.handlePairingResult(result);
    this.boundStatus = status => {
      if (!status?.connected) this.clearPairing('cloud-disconnected');
    };

    this.connectionManager.on('pairing-request', this.boundPairingRequest);
    this.connectionManager.on('pairing-result', this.boundPairingResult);
    this.connectionManager.on('status', this.boundStatus);
  }

  async generatePairingQR(options = {}) {
    if (!this.connectionManager.isConnected()) {
      return {
        success: false,
        message: 'Connect to Relay Server first.'
      };
    }

    this.clearPairing('new-cloud-qr');
    const token = await this.connectionManager.requestPairToken({
      ttlMs: options.ttlMs || this.tokenTtlMs
    });
    const relayUrl = this.connectionManager.getStatus().relayUrl;
    const pairingSecret = generateSecret();
    const masterKey = generateSecret();
    let blockchainPair = null;
    try {
      if (this.blockchainService?.createPair) {
        blockchainPair = await this.blockchainService.createPair({
          pairToken: token.token,
          ttlMs: options.ttlMs || this.tokenTtlMs
        });
      }
    } catch (error) {
      this.logger.warn('[CLOUD] Blockchain pair registration failed; continuing with relay pairing', {
        error: error.message
      });
    }
    const payload = {
      version: CLOUD_PAIR_VERSION,
      relayUrl,
      pairToken: token.token,
      expiresAt: token.expiresAt,
      blockchain: blockchainPair?.qr || null,
      security: {
        scheme: 'openx-e2ee-v1',
        enabled: true
      }
    };
    this.validatePayload(payload);
    const qrPayload = {
      v: CLOUD_PAIR_VERSION,
      u: relayUrl,
      t: token.token,
      e: token.expiresAt,
      s: pairingSecret,
      b: blockchainPair?.qr || null
    };
    const qrDataUrl = await this.qrCode.toDataURL(JSON.stringify(qrPayload), {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320
    });
    this.currentPairing = {
      payload,
      qrDataUrl,
      tokenId: token.tokenId,
      createdAt: token.createdAt,
      pairingSecret,
      masterKey,
      blockchainPair
    };
    this.logger.info('[CLOUD] Cloud pairing QR generated', {
      tokenId: token.tokenId,
      expiresAt: token.expiresAt
    });
    return {
      success: true,
      payload: { ...payload },
      tokenId: token.tokenId,
      qrDataUrl
    };
  }

  approvePairing(pairRequestId) {
    const request = this.pendingRequests.get(pairRequestId);
    let security = null;
    try {
      security = this.createApprovalSecurity(pairRequestId);
    } catch (error) {
      this.logger.warn('[CLOUD] Secure pairing approval failed', {
        pairRequestId,
        error: error.message
      });
      return {
        success: false,
        request: request || null,
        message: 'Secure pairing approval failed.'
      };
    }
    const masterKey = security?.masterKey || '';
    const approvalSecurity = security ? {
      scheme: security.scheme,
      e2ee: security.e2ee,
      encryptedMasterKey: security.encryptedMasterKey
    } : null;
    const sent = this.connectionManager.approvePairingRequest(pairRequestId, approvalSecurity);
    if (sent && masterKey) this.pendingSecureApprovals.set(pairRequestId, masterKey);
    if (sent) this.pendingRequests.delete(pairRequestId);
    return {
      success: sent,
      request: request || null,
      message: sent ? 'Pairing approved.' : 'Unable to approve pairing.'
    };
  }

  createApprovalSecurity(pairRequestId) {
    const current = this.currentPairing || null;
    if (!current?.pairingSecret || !current?.masterKey) return null;
    const encryptedMasterKey = encryptJson(current.pairingSecret, {
      masterKey: current.masterKey,
      createdAt: this.now(),
      pairRequestId
    }, {
      domain: 'pairing-master-key',
      context: {
        pairRequestId,
        tokenId: current.tokenId || ''
      },
      aad: {
        pairRequestId,
        tokenId: current.tokenId || ''
      }
    });
    return {
      scheme: 'openx-e2ee-v1',
      e2ee: true,
      encryptedMasterKey,
      masterKey: current.masterKey
    };
  }

  rejectPairing(pairRequestId) {
    const request = this.pendingRequests.get(pairRequestId);
    const sent = this.connectionManager.rejectPairingRequest(pairRequestId);
    if (sent) {
      this.pendingRequests.delete(pairRequestId);
      this.pendingSecureApprovals.delete(pairRequestId);
    }
    return {
      success: sent,
      request: request || null,
      message: sent ? 'Pairing rejected.' : 'Unable to reject pairing.'
    };
  }

  getStatus() {
    const current = this.currentPairing || null;
    return {
      connected: this.connectionManager.isConnected(),
      hasActiveQr: Boolean(current?.payload && current.payload.expiresAt > this.now()),
      currentPairing: current ? {
        ...current.payload,
        tokenId: current.tokenId,
        qrDataUrl: current.qrDataUrl
      } : null,
      pendingRequests: [...this.pendingRequests.values()].map(request => ({ ...request }))
    };
  }

  handlePairingRequest(request = {}) {
    if (!request.pairRequestId) return;
    const current = this.currentPairing || null;
    const isActiveQrRequest =
      current?.tokenId &&
      current?.payload?.expiresAt > this.now() &&
      request.tokenId === current.tokenId;

    if (isActiveQrRequest) {
      this.pendingRequests.set(request.pairRequestId, {
        pairRequestId: request.pairRequestId,
        requestId: request.requestId || request.pairRequestId,
        tokenId: request.tokenId || '',
        phoneConnectionId: request.phoneConnectionId || '',
        blockchain: request.blockchain || null,
        device: {
          name: request.device?.name || 'OpenX Mobile',
          type: request.device?.type || 'mobile'
        },
        createdAt: request.createdAt || this.now(),
        autoApproved: true
      });
      this.emit('request', this.getStatus());
      this.verifyBlockchainPairRequest(request, current)
        .then(verified => {
          if (!verified) return;
          const result = this.approvePairing(request.pairRequestId);
          this.logger.info('[CLOUD] Cloud pairing auto-approved from active QR', {
            pairRequestId: request.pairRequestId,
            tokenId: request.tokenId || '',
            blockchainTrusted: Boolean(request.blockchain?.pairHash),
            success: result.success === true
          });
        })
        .catch(error => {
          this.logger.warn('[CLOUD] Blockchain pair trust verification failed', {
            pairRequestId: request.pairRequestId,
            error: error.message
          });
        });
      return;
    }

    this.pendingRequests.set(request.pairRequestId, {
      pairRequestId: request.pairRequestId,
      requestId: request.requestId || request.pairRequestId,
      tokenId: request.tokenId || '',
      phoneConnectionId: request.phoneConnectionId || '',
      blockchain: request.blockchain || null,
      device: {
        name: request.device?.name || 'OpenX Mobile',
        type: request.device?.type || 'mobile'
      },
      createdAt: request.createdAt || this.now()
    });
    this.emit('request', this.getStatus());
  }

  async verifyBlockchainPairRequest(request, current) {
    const expected = current?.blockchainPair?.pair || null;
    if (!expected?.pairHash || !this.blockchainService?.getPair) return true;
    const providedHash = String(request.blockchain?.pairHash || '').trim();
    if (providedHash !== expected.pairHash) return false;
    if (this.blockchainService.getStatus?.().pairing?.registryConfigured !== true) {
      return true;
    }
    const pair = await this.blockchainService.getPair(expected.pairHash);
    return String(pair?.status || '').toUpperCase() === 'APPROVED';
  }

  handlePairingResult(result = {}) {
    if (result.pairRequestId) {
      this.pendingRequests.delete(result.pairRequestId);
    }
    this.applyConfirmedSecurity(result);
    this.clearPairing('pairing-complete');
    this.emit('result', result);
  }

  applyConfirmedSecurity(result = {}) {
    const pairRequestId = String(result.pairRequestId || '').trim();
    const pendingMasterKey = pairRequestId ? this.pendingSecureApprovals.get(pairRequestId) : '';
    if (!pairRequestId || !pendingMasterKey) return false;
    this.pendingSecureApprovals.delete(pairRequestId);
    if (result.type === 'cloud-pair:paired' && result.security?.encryptedMasterKey) {
      this.connectionManager.setE2EEMasterKey?.(pendingMasterKey);
      this.secureKeyStore?.saveMasterKey?.(pendingMasterKey);
      return true;
    }
    this.connectionManager.setE2EEMasterKey?.('');
    this.secureKeyStore?.deleteMasterKey?.();
    this.logger.warn('[CLOUD] Secure pairing was not confirmed by relay; continuing without E2EE', {
      pairRequestId,
      type: result.type || ''
    });
    return false;
  }

  validatePayload(payload) {
    const keys = Object.keys(payload).sort();
    const allowed = ['blockchain', 'expiresAt', 'pairToken', 'relayUrl', 'security', 'version'];
    const required = ['expiresAt', 'pairToken', 'relayUrl', 'security', 'version'];
    if (!required.every(key => Object.prototype.hasOwnProperty.call(payload, key)) ||
        keys.some(key => !allowed.includes(key))) {
      throw new TypeError('Invalid cloud pairing payload fields');
    }
    const relayUrl = new URL(payload.relayUrl);
    if (!['ws:', 'wss:'].includes(relayUrl.protocol)) {
      throw new TypeError('Cloud QR relay URL must use ws or wss');
    }
    if (payload.version !== CLOUD_PAIR_VERSION) {
      throw new TypeError('Unsupported cloud QR version');
    }
    if (typeof payload.pairToken !== 'string' || payload.pairToken.length < 32) {
      throw new TypeError('Invalid cloud pair token');
    }
    if (!Number.isFinite(payload.expiresAt) || payload.expiresAt <= this.now()) {
      throw new TypeError('Invalid cloud pair expiration');
    }
    if (
      payload.security?.scheme !== 'openx-e2ee-v1' ||
      payload.security?.enabled !== true
    ) {
      throw new TypeError('Invalid cloud pairing security payload');
    }
  }

  clearPairing(reason = 'clear') {
    this.currentPairing = null;
    this.pendingRequests.clear();
    if (reason !== 'pairing-complete') this.pendingSecureApprovals.clear();
    this.emit('status', this.getStatus({ reason }));
  }

  destroy() {
    this.connectionManager.off('pairing-request', this.boundPairingRequest);
    this.connectionManager.off('pairing-result', this.boundPairingResult);
    this.connectionManager.off('status', this.boundStatus);
    this.removeAllListeners();
    this.clearPairing('destroy');
  }
}

CloudPairingManager.CLOUD_PAIR_VERSION = CLOUD_PAIR_VERSION;

module.exports = CloudPairingManager;
