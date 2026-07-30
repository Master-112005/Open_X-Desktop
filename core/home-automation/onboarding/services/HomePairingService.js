class HomePairingService {
  constructor(options = {}) {
    this.serverClient = options.serverClient || null;
  }

  async approvePairing({ device, ownerId = 'desktop-owner', serverAddress = '' }) {
    if (typeof this.serverClient?.approveHomePairing === 'function') {
      return this.serverClient.approveHomePairing({ device, ownerId, serverAddress });
    }
    return {
      success: true,
      paired: true,
      ownerId,
      deviceId: device.deviceId,
      serverAddress,
      message: 'Pairing approval is ready for OpenX_Server transport.'
    };
  }
}

module.exports = HomePairingService;
