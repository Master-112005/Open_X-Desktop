const { createPublicDevice, cleanDeviceId, isValidDeviceId, cleanString } = require('../utilities/OnboardingSanitizer');

function isDiagnosticDevice(device = {}) {
  const deviceId = String(device.deviceId || '').toLowerCase();
  const deviceName = String(device.deviceName || device.name || '').toLowerCase();
  return deviceId.startsWith('diag_') || deviceId.includes('diagnostic') || deviceName.includes('diagnostic');
}

class HomeDeviceDiscoveryManager {
  constructor(options = {}) {
    this.now = options.now || (() => Date.now());
    this.discoveryTtlMs = Number(options.discoveryTtlMs) || 90 * 1000;
    this.discoveryIntervalMs = Number(options.discoveryIntervalMs) || 5000;
    this.transport = options.transport || null;
    this.store = options.store || null;
    this.devices = new Map();
    this.listeners = new Set();
    this.timer = null;
    this.started = false;
    this.loadPersistedDevices();
  }

  loadPersistedDevices() {
    if (!this.store) return;
    let persisted = [];
    try {
      persisted = this.store.list();
    } catch (_) {
      return;
    }
    for (const device of persisted) {
      const normalized = createPublicDevice({ ...device, connectionStatus: 'offline' });
      if (!isValidDeviceId(normalized.deviceId)) continue;
      this.devices.set(normalized.deviceId, normalized);
    }
  }

  persistPairedDevice(device) {
    if (!this.store || !device || device.pairingStatus !== 'paired') return;
    try {
      this.store.upsert(device);
    } catch (_) {
      // Persistence is best-effort; in-memory state remains authoritative for this session.
    }
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
    if (isDiagnosticDevice(candidate)) {
      return { success: false, code: 'diagnostic-device-hidden', message: 'Diagnostic Home device records are hidden from setup.' };
    }
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
    if (merged.pairingStatus === 'paired') this.persistPairedDevice(merged);
    return { success: true, device: this.toPublicDevice(merged), duplicate: Boolean(existing) };
  }

  removeUnavailableDevices() {
    const now = this.now();
    let removed = 0;
    for (const [deviceId, device] of this.devices.entries()) {
      const lastSeen = Date.parse(device.lastSeenAt);
      if (Number.isFinite(lastSeen) && lastSeen + this.discoveryTtlMs > now) continue;
      if (device.pairingStatus === 'paired') {
        // Paired devices are the user's own Connected Devices: keep them listed
        // (as offline) instead of pruning, so rename/remove stay available.
        if (device.connectionStatus !== 'offline') {
          device.connectionStatus = 'offline';
          this.emit('device_updated', device);
        }
        continue;
      }
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
    if (device.pairingStatus === 'paired') this.persistPairedDevice(device);
    return this.toPublicDevice(device);
  }

  renameDevice(deviceId, deviceName) {
    const device = this.devices.get(cleanDeviceId(deviceId));
    if (!device) return null;
    device.deviceName = cleanString(deviceName, 100) || device.deviceName;
    device.updatedAt = new Date(this.now()).toISOString();
    this.emit('device_updated', device);
    if (device.pairingStatus === 'paired') this.persistPairedDevice(device);
    return this.toPublicDevice(device);
  }

  removeDevice(deviceId) {
    const normalizedId = cleanDeviceId(deviceId);
    const existed = this.devices.delete(normalizedId);
    if (existed) {
      this.emit('device_removed', { deviceId: normalizedId });
      try {
        this.store?.remove(normalizedId);
      } catch (_) {
        // Best-effort cleanup; a stale on-disk record is harmless.
      }
    }
    return existed;
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
