const HomeDeviceDiscoveryManager = require('../discovery/HomeDeviceDiscoveryManager');
const HomeOnboardingStateManager = require('../state/HomeOnboardingStateManager');
const HomeConfigurationService = require('../services/HomeConfigurationService');
const HomePairingService = require('../services/HomePairingService');
const { HOME_ONBOARDING_STATES } = require('../constants/OnboardingStates');

function isDiagnosticServerDevice(device = {}) {
  const deviceId = String(device.deviceId || '').toLowerCase();
  const deviceName = String(device.deviceName || device.name || '').toLowerCase();
  return deviceId.startsWith('diag_') || deviceId.includes('diagnostic') || deviceName.includes('diagnostic');
}

class HomeOnboardingManager {
  constructor(options = {}) {
    this.now = options.now || (() => Date.now());
    this.discovery = options.discovery?.start
      ? options.discovery
      : new HomeDeviceDiscoveryManager(options.discovery || options);
    this.state = options.state?.startSession
      ? options.state
      : new HomeOnboardingStateManager({ now: this.now });
    this.configuration = options.configuration?.sendConfiguration
      ? options.configuration
      : new HomeConfigurationService(options.configuration || {});
    this.pairing = options.pairing?.approvePairing
      ? options.pairing
      : new HomePairingService(options.pairing || {});
    this.lastServerAddress = options.defaultServerAddress || 'wss://openx-server.onrender.com/ws';
    this.serverClient = options.serverClient || null;
    this.ownerId = options.ownerId || 'desktop-owner';
    this.connectionWaitTimeoutMs = Number(options.connectionWaitTimeoutMs) || 90000;
    this.connectionPollIntervalMs = Number(options.connectionPollIntervalMs) || 1500;
  }

  startDiscovery() {
    return { success: true, ...this.discovery.start() };
  }

  stopDiscovery() {
    return { success: true, ...this.discovery.stop() };
  }

  addDiscoveredDevice(device) {
    return this.discovery.addDiscoveredDevice(device);
  }

  async refreshServerDevices(ownerId = this.ownerId) {
    if (typeof this.serverClient?.listHomeDevices !== 'function') {
      return { success: false, code: 'server-client-unavailable', message: 'OpenX_Server device refresh is unavailable.' };
    }
    const result = await this.serverClient.listHomeDevices({
      serverAddress: this.lastServerAddress,
      ownerId
    });
    if (!result?.success) return result;
    const devices = Array.isArray(result.devices) ? result.devices : [];
    let added = 0;
    let reclaimed = 0;
    for (const device of devices) {
      if (isDiagnosticServerDevice(device)) continue;
      const serverPairStatus = String(device.pairStatus || device.pairingStatus || 'unpaired').toLowerCase();
      const wasOursLocally = this.discovery.getDevice(device.deviceId)?.pairingStatus === 'paired';
      if (serverPairStatus !== 'paired' && wasOursLocally) {
        const reclaimedDevice = await this.reclaimDevice(device, ownerId);
        if (reclaimedDevice) {
          reclaimed += 1;
          added += 1;
          continue;
        }
      }
      const upserted = this.discovery.addDiscoveredDevice({
        ...device,
        deviceStatus: device.status || device.registrationState || device.deviceStatus || 'registered',
        pairingStatus: serverPairStatus,
        discoverySource: 'openx-server',
        transport: 'server'
      }, { includePaired: true });
      if (upserted.success) added += 1;
    }
    return { success: true, devices, added, reclaimed };
  }

  /**
   * A device we previously paired can come back from OpenX_Server unowned
   * after the server restarts (its device registry is in-memory only), even
   * though the physical device kept its Wi-Fi credentials and reconnected on
   * its own. Rather than forcing the user through Bluetooth + Wi-Fi setup
   * again, silently re-claim ownership - the device is already registered
   * and reachable, so pairing is just an HTTP formality at this point.
   */
  async reclaimDevice(device, ownerId = this.ownerId) {
    if (typeof this.pairing?.approvePairing !== 'function') return null;
    const result = await this.pairing.approvePairing({ device, ownerId, serverAddress: this.lastServerAddress });
    if (!result.success) return null;
    this.discovery.addDiscoveredDevice({
      ...device,
      deviceStatus: device.status || device.registrationState || device.deviceStatus || 'registered',
      pairingStatus: 'paired',
      discoverySource: 'openx-server',
      transport: 'server'
    }, { includePaired: true });
    return this.discovery.markPaired(device.deviceId);
  }

  async refreshDevice(deviceId, ownerId = this.ownerId) {
    const normalizedId = String(deviceId || '').trim();
    if (!normalizedId) return { success: false, code: 'missing-device-id', message: 'Home device ID is required.' };
    if (typeof this.serverClient?.getHomeDevice !== 'function') {
      return { success: false, code: 'server-client-unavailable', message: 'OpenX_Server device refresh is unavailable.' };
    }
    const result = await this.serverClient.getHomeDevice({ serverAddress: this.lastServerAddress, deviceId: normalizedId });
    if (!result?.success || !result.device) {
      try {
        await this.refreshServerDevices(ownerId);
      } catch (_) {}
      const existing = this.discovery.getDevice(normalizedId);
      if (String(existing?.connectionStatus || '').toLowerCase() === 'online') {
        return { success: true, device: existing, reclaimed: existing.pairingStatus === 'paired' };
      }
      return existing
        ? { success: false, ...result, device: existing }
        : result;
    }
    const existing = this.discovery.getDevice(normalizedId);
    const serverPairStatus = String(result.device.pairStatus || result.device.pairingStatus || 'unpaired').toLowerCase();
    if (serverPairStatus !== 'paired' && existing?.pairingStatus === 'paired') {
      const reclaimedDevice = await this.reclaimDevice(result.device, ownerId);
      if (reclaimedDevice) return { success: true, device: reclaimedDevice, reclaimed: true };
    }
    const upserted = this.discovery.addDiscoveredDevice({
      ...result.device,
      deviceStatus: result.device.status || result.device.registrationState || result.device.deviceStatus || 'registered',
      pairingStatus: result.device.pairStatus || result.device.pairingStatus || 'unpaired',
      discoverySource: 'openx-server',
      transport: 'server'
    }, { includePaired: true });
    return { success: true, device: upserted.device || result.device };
  }

  getSnapshot() {
    return {
      success: true,
      discovery: this.discovery.getSnapshot(),
      activeSessions: this.listActiveSessions(),
      serverAddress: this.lastServerAddress
    };
  }

  listDevices() {
    return {
      success: true,
      devices: this.discovery.listDevices()
    };
  }

  startOnboarding(deviceId) {
    const device = this.discovery.getDevice(deviceId);
    if (!device) return { success: false, code: 'device-not-found', message: 'Home device was not found.' };
    return this.state.startSession(device);
  }

  async sendConfiguration({ sessionId, ssid, password, serverAddress }) {
    const session = this.state.getSession(sessionId);
    if (!session) return { success: false, code: 'session-not-found', message: 'Onboarding session was not found.' };
    this.state.transition(sessionId, HOME_ONBOARDING_STATES.CONFIGURATION_STARTED, 'wifi', 34, 'Configuration started.');
    const result = await this.configuration.sendConfiguration(session.device, { ssid, password, serverAddress });
    if (!result.success) {
      const failed = this.state.fail(sessionId, result.message || 'Configuration failed.', result.code || 'configuration-failed');
      return { success: false, ...result, session: failed };
    }
    this.lastServerAddress = result.serverAddress || serverAddress || this.lastServerAddress;
    this.discovery.markConfigured(session.deviceId, {
      deviceStatus: 'configuration_sent',
      configuredAt: new Date(this.now()).toISOString()
    });
    const updated = this.state.transition(sessionId, HOME_ONBOARDING_STATES.CONFIGURATION_SENT, 'transfer', 52, 'Configuration sent.');
    return { success: true, session: updated, credentialsStored: false };
  }

  waitForConnection(sessionId) {
    const session = this.state.getSession(sessionId);
    if (!session) return { success: false, code: 'session-not-found', message: 'Onboarding session was not found.' };
    const waiting = this.state.transition(sessionId, HOME_ONBOARDING_STATES.WAITING_CONNECTION, 'connecting', 68, 'Waiting for device connection.');
    if (typeof this.serverClient?.getHomeDevice !== 'function') {
      const device = this.discovery.markConnected(session.deviceId);
      const connected = this.state.transition(sessionId, HOME_ONBOARDING_STATES.CONNECTED, 'approval', 78, 'Device connected successfully.');
      return { success: true, session: connected || waiting, device };
    }
    return this.waitForServerConnection(sessionId, waiting);
  }

  async waitForServerConnection(sessionId, waitingSession) {
    const session = this.state.getSession(sessionId);
    const deadline = this.now() + this.connectionWaitTimeoutMs;
    let lastResult = null;
    while (this.now() <= deadline) {
      lastResult = await this.serverClient.getHomeDevice({
        serverAddress: this.lastServerAddress,
        deviceId: session.deviceId
      });
      const device = lastResult?.device || null;
      if (lastResult?.success && device?.deviceId) {
        this.discovery.addDiscoveredDevice({
          ...device,
          deviceStatus: device.status || device.registrationState || 'registered',
          pairingStatus: device.pairStatus || 'unpaired',
          discoverySource: 'openx-server',
          transport: 'server'
        }, { includePaired: true });
        if (String(device.connectionStatus || '').toLowerCase() === 'online') {
          const connectedDevice = this.discovery.markConnected(session.deviceId);
          const connected = this.state.transition(sessionId, HOME_ONBOARDING_STATES.CONNECTED, 'approval', 78, 'Device connected through OpenX_Server.');
          return { success: true, session: connected || waitingSession, device: connectedDevice || device };
        }
      }
      await new Promise(resolve => setTimeout(resolve, this.connectionPollIntervalMs));
    }
    const failed = this.state.fail(
      sessionId,
      'The Home Device did not appear on OpenX_Server yet. Keep it powered on, check Wi-Fi, then press Scan.',
      lastResult?.code || 'home-device-not-online'
    );
    return {
      success: false,
      code: lastResult?.code || 'home-device-not-online',
      message: failed.error,
      session: failed
    };
  }

  async renameDevice(deviceId, ownerId = this.ownerId, deviceName) {
    const trimmedName = String(deviceName || '').trim();
    if (!trimmedName) return { success: false, code: 'missing-device-name', message: 'Enter a name for this device.' };
    if (typeof this.serverClient?.renameDevice !== 'function') {
      const device = this.discovery.renameDevice(deviceId, trimmedName);
      return device
        ? { success: true, device }
        : { success: false, code: 'device-not-found', message: 'Home device was not found.' };
    }
    const result = await this.serverClient.renameDevice({
      serverAddress: this.lastServerAddress,
      deviceId,
      ownerId,
      deviceName: trimmedName
    });
    if (!result.success) return result;
    const device = this.discovery.renameDevice(deviceId, trimmedName);
    return { success: true, device: device || result.device };
  }

  async removeDevice(deviceId, ownerId = this.ownerId) {
    if (typeof this.serverClient?.forgetDevice !== 'function') {
      this.discovery.removeDevice(deviceId);
      return { success: true, notified: false };
    }
    const result = await this.serverClient.forgetDevice({
      serverAddress: this.lastServerAddress,
      deviceId,
      ownerId
    });
    // If OpenX_Server no longer considers this ours (e.g. its in-memory
    // registry was reset by a restart), there is nothing left to protect -
    // let the user clear it from their own list regardless.
    const nothingToProtect = result.code === 'unknown-home-device' || result.code === 'home-owner-mismatch';
    if (!result.success && !nothingToProtect) return result;
    this.discovery.removeDevice(deviceId);
    return { success: true, notified: result.notified === true };
  }

  async approvePairing({ sessionId, ownerId = this.ownerId }) {
    const session = this.state.getSession(sessionId);
    if (!session) return { success: false, code: 'session-not-found', message: 'Onboarding session was not found.' };
    this.state.transition(sessionId, HOME_ONBOARDING_STATES.WAITING_APPROVAL, 'approval', 86, 'Waiting for pairing approval.');
    const result = await this.pairing.approvePairing({
      device: session.device,
      ownerId,
      serverAddress: this.lastServerAddress
    });
    if (!result.success) {
      const failed = this.state.fail(sessionId, result.message || 'Pairing rejected.', result.code || 'pairing-failed');
      return { success: false, ...result, session: failed };
    }
    const device = this.discovery.markPaired(session.deviceId);
    const paired = this.state.transition(sessionId, HOME_ONBOARDING_STATES.PAIRING_COMPLETE, 'complete', 96, 'Pairing complete.');
    return { success: true, session: paired, device, pairing: result };
  }

  finish(sessionId) {
    const session = this.state.getSession(sessionId);
    if (!session) return { success: false, code: 'session-not-found', message: 'Onboarding session was not found.' };
    const finished = this.state.transition(sessionId, HOME_ONBOARDING_STATES.FINISHED, 'complete', 100, 'Setup finished.');
    return { success: true, session: finished, devices: this.discovery.listDevices() };
  }

  cancel(sessionId) {
    const session = this.state.cancel(sessionId);
    return session
      ? { success: true, session }
      : { success: false, code: 'session-not-found', message: 'Onboarding session was not found.' };
  }

  listActiveSessions() {
    return [...this.state.sessions.values()]
      .map(session => this.state.toPublicSession(session))
      .filter(session => !['finished', 'failed', 'cancelled'].includes(session.state));
  }
}

module.exports = HomeOnboardingManager;
