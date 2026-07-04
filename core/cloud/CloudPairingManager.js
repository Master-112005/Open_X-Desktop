const EventEmitter = require('events');
const QRCode = require('qrcode');

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
    this.logger = options.logger || console;
    this.now = options.now || (() => Date.now());
    this.tokenTtlMs = Number(options.tokenTtlMs) || DEFAULT_TOKEN_TTL_MS;
    this.currentPairing = null;
    this.pendingRequests = new Map();

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
    const payload = {
      version: CLOUD_PAIR_VERSION,
      relayUrl,
      pairToken: token.token,
      expiresAt: token.expiresAt
    };
    this.validatePayload(payload);
    const qrDataUrl = await this.qrCode.toDataURL(JSON.stringify(payload), {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320
    });
    this.currentPairing = {
      payload,
      qrDataUrl,
      tokenId: token.tokenId,
      createdAt: token.createdAt
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
    const sent = this.connectionManager.approvePairingRequest(pairRequestId);
    if (sent) this.pendingRequests.delete(pairRequestId);
    return {
      success: sent,
      request: request || null,
      message: sent ? 'Pairing approved.' : 'Unable to approve pairing.'
    };
  }

  rejectPairing(pairRequestId) {
    const request = this.pendingRequests.get(pairRequestId);
    const sent = this.connectionManager.rejectPairingRequest(pairRequestId);
    if (sent) this.pendingRequests.delete(pairRequestId);
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
    this.pendingRequests.set(request.pairRequestId, {
      pairRequestId: request.pairRequestId,
      requestId: request.requestId || request.pairRequestId,
      tokenId: request.tokenId || '',
      phoneConnectionId: request.phoneConnectionId || '',
      device: {
        name: request.device?.name || 'OpenX Mobile',
        type: request.device?.type || 'mobile'
      },
      createdAt: request.createdAt || this.now()
    });
    this.emit('request', this.getStatus());
  }

  handlePairingResult(result = {}) {
    if (result.pairRequestId) {
      this.pendingRequests.delete(result.pairRequestId);
    }
    this.clearPairing('pairing-complete');
    this.emit('result', result);
  }

  validatePayload(payload) {
    const keys = Object.keys(payload).sort();
    const required = ['expiresAt', 'pairToken', 'relayUrl', 'version'];
    if (keys.length !== required.length || keys.some((key, index) => key !== required[index])) {
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
  }

  clearPairing(reason = 'clear') {
    this.currentPairing = null;
    this.pendingRequests.clear();
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
