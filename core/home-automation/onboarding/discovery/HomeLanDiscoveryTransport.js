const dgram = require('dgram');
const { cleanString, createPublicDevice } = require('../utilities/OnboardingSanitizer');

class HomeLanDiscoveryTransport {
  constructor(options = {}) {
    this.port = Number(options.port) || 43117;
    this.multicastAddress = cleanString(options.multicastAddress || '239.88.77.66', 64);
    this.logger = options.logger || null;
    this.socket = null;
    this.devices = new Map();
    this.started = false;
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    this.socket.on('message', (message, rinfo) => this.handleMessage(message, rinfo));
    this.socket.on('error', error => {
      this.logger?.warn?.('Home device LAN discovery socket error', { error: error.message });
      this.stop();
    });
    this.socket.bind(this.port, () => {
      try {
        this.socket.addMembership(this.multicastAddress);
      } catch (error) {
        this.logger?.debug?.('Home device multicast membership skipped', { error: error.message });
      }
    });
    this.socket.unref?.();
  }

  stop() {
    this.started = false;
    if (!this.socket) return;
    try {
      this.socket.close();
    } catch (_) {
      // Ignore close races during app shutdown.
    }
    this.socket = null;
  }

  discover() {
    this.start();
    return [...this.devices.values()];
  }

  handleMessage(message, rinfo = {}) {
    let payload = null;
    try {
      payload = JSON.parse(message.toString('utf8'));
    } catch (_) {
      return;
    }
    const marker = cleanString(payload.type || payload.advertisement || payload.service, 80).toLowerCase();
    const deviceName = cleanString(payload.deviceName || payload.name || '', 100).toLowerCase();
    if (
      marker !== 'openx-home-device' &&
      marker !== 'home:device-advertisement' &&
      !deviceName.includes('openx home device')
    ) {
      return;
    }
    const device = createPublicDevice({
      deviceId: payload.deviceId,
      deviceName: payload.deviceName || 'OpenX Home Device',
      firmwareVersion: payload.firmwareVersion,
      protocolVersion: payload.protocolVersion || 'openx-home-v1',
      deviceStatus: payload.deviceStatus || 'ready_for_setup',
      pairingStatus: payload.pairingStatus || 'unpaired',
      capabilities: payload.capabilities || payload.supportedCapabilities,
      configurationUrl: payload.configurationUrl || payload.setupUrl || '',
      ipAddress: rinfo.address || ''
    });
    if (!device.deviceId) return;
    this.devices.set(device.deviceId, {
      ...device,
      configurationUrl: cleanString(payload.configurationUrl || payload.setupUrl || '', 240),
      ipAddress: cleanString(rinfo.address || payload.ipAddress || '', 80)
    });
  }
}

module.exports = HomeLanDiscoveryTransport;
