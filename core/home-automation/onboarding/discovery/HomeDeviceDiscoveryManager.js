const { createPublicDevice, cleanDeviceId, isValidDeviceId } = require('../utilities/OnboardingSanitizer');

class HomeDeviceDiscoveryManager {
  constructor(options = {}) {
    this.now = options.now || (() => Date.now());
    this.discoveryTtlMs = Number(options.discoveryTtlMs) || 90 * 1000;
    this.discoveryIntervalMs = Number(options.discoveryIntervalMs) || 5000;
    this.transport = options.transport || null;
    this.devices = new Map();
    this.listeners = new Set();
    this.timer = null;
    this.started = false;
  }

  start() {
    if (this.started) return this.getSnapshot();
    this.started = true;
    this.scanOnce();
    this.timer = setInterval(() => this.scanOnce(), this.discoveryIntervalMs);
    this.timer.unref?.();
    this.emit('discovery_started');
    return this.getSnapshot();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.started = false;
    this.transport?.stop?.();
    this.emit('discovery_stopped');
    return this.getSnapshot();
  }

  scanOnce() {
    const discovered = typeof this.transport?.discover === 'function'
      ? this.transport.discover()
      : [];
    for (const device of discovered || []) {
      this.addDiscoveredDevice(device);
    }
    this.removeUnavailableDevices();
    return this.getSnapshot();
  }

  addDiscoveredDevice(candidate = {}, options = {}) {
    const device = createPublicDevice({
      ...candidate,
      deviceName: candidate.deviceName || candidate.name || 'OpenX Home Device',
      deviceStatus: candidate.deviceStatus || 'ready_for_setup'
    });
    if (!isValidDeviceId(device.deviceId)) {
      return { success: false, code: 'invalid-device-id', message: 'Discovered home device has an invalid device ID.' };
    }
    const includePaired = options.includePaired === true;
    if (!includePaired && (device.pairingStatus === 'paired' || device.deviceStatus === 'onboarded')) {
      return { success: false, code: 'already-onboarded', message: 'Home device already completed onboarding.' };
    }
    const existing = this.devices.get(device.deviceId);
    const merged = {
      ...(existing || {}),
      ...device,
      discoveredAt: existing?.discoveredAt || device.discoveredAt,
      lastSeenAt: new Date(this.now()).toISOString()
    };
    this.devices.set(device.deviceId, merged);
    if (!existing) this.emit('device_found', merged);
    return { success: true, device: this.toPublicDevice(merged), duplicate: Boolean(existing) };
  }

  removeUnavailableDevices() {
    const now = this.now();
    let removed = 0;
    for (const [deviceId, device] of this.devices.entries()) {
      const lastSeen = Date.parse(device.lastSeenAt);
      if (Number.isFinite(lastSeen) && lastSeen + this.discoveryTtlMs > now) continue;
      this.devices.delete(deviceId);
      removed += 1;
    }
    if (removed) this.emit('devices_pruned', { removed });
    return removed;
  }

  markConfigured(deviceId, updates = {}) {
    const device = this.devices.get(cleanDeviceId(deviceId));
    if (!device) return null;
    Object.assign(device, updates, {
      deviceStatus: updates.deviceStatus || device.deviceStatus,
      configuredAt: updates.configuredAt || new Date(this.now()).toISOString(),
      lastSeenAt: new Date(this.now()).toISOString()
    });
    this.emit('device_updated', device);
    return this.toPublicDevice(device);
  }

  markConnected(deviceId) {
    return this.markConfigured(deviceId, {
      connectionStatus: 'online',
      deviceStatus: 'connected'
    });
  }

  markPaired(deviceId) {
    return this.markConfigured(deviceId, {
      connectionStatus: 'online',
      pairingStatus: 'paired',
      deviceStatus: 'ready',
      pairedAt: new Date(this.now()).toISOString()
    });
  }

  getDevice(deviceId) {
    const device = this.devices.get(cleanDeviceId(deviceId));
    return device ? this.toPublicDevice(device) : null;
  }

  listDevices() {
    this.removeUnavailableDevices();
    return [...this.devices.values()]
      .map(device => this.toPublicDevice(device))
      .sort((left, right) => {
        const leftPaired = left.pairingStatus === 'paired' ? 1 : 0;
        const rightPaired = right.pairingStatus === 'paired' ? 1 : 0;
        if (leftPaired !== rightPaired) return leftPaired - rightPaired;
        return left.deviceName.localeCompare(right.deviceName);
      });
  }

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event, payload = null) {
    for (const listener of this.listeners) {
      try {
        listener({ event, payload, snapshot: this.getSnapshot() });
      } catch (_) {
        // UI observers should never break discovery.
      }
    }
  }

  getSnapshot() {
    return {
      discoveryStarted: this.started,
      devices: this.listDevices(),
      updatedAt: new Date(this.now()).toISOString()
    };
  }

  clear() {
    this.stop();
    const count = this.devices.size;
    this.devices.clear();
    return count;
  }

  toPublicDevice(device) {
    return createPublicDevice(device);
  }
}

module.exports = HomeDeviceDiscoveryManager;
