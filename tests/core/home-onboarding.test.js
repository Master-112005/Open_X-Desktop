const assert = require('assert');
const {
  HomeOnboardingManager,
  HomeDeviceDiscoveryManager,
  HomeConfigurationService
} = require('../../core/home-automation');

describe('Home Automation Desktop Onboarding', function() {
  it('discovers new OpenX Home Devices and ignores already paired devices', function() {
    const discovery = new HomeDeviceDiscoveryManager();
    discovery.start();

    const found = discovery.addDiscoveredDevice({
      deviceId: 'home_device_1',
      deviceName: 'OpenX Home Device',
      firmwareVersion: '1.0.0',
      protocolVersion: 'openx-home-v1',
      deviceStatus: 'ready_for_setup'
    });
    const ignored = discovery.addDiscoveredDevice({
      deviceId: 'home_device_2',
      deviceName: 'OpenX Home Device',
      pairingStatus: 'paired'
    });

    assert.equal(found.success, true);
    assert.equal(ignored.success, false);
    assert.equal(discovery.listDevices().length, 1);
    assert.equal(discovery.listDevices()[0].deviceId, 'home_device_1');
  });

  it('hides diagnostic server records from desktop setup', function() {
    const discovery = new HomeDeviceDiscoveryManager();
    const diagnostic = discovery.addDiscoveredDevice({
      deviceId: 'diag_openx_device_123',
      deviceName: 'OpenX Diagnostic Device',
      discoverySource: 'openx-server',
      transport: 'server'
    }, { includePaired: true });

    assert.equal(diagnostic.success, false);
    assert.equal(diagnostic.code, 'diagnostic-device-hidden');
    assert.equal(discovery.listDevices().length, 0);
  });

  it('validates Wi-Fi and OpenX_Server configuration without storing credentials', async function() {
    const service = new HomeConfigurationService();
    const invalid = service.validateConfiguration({
      ssid: '',
      password: 'secret',
      serverAddress: 'wss://openx-server.onrender.com/ws'
    });
    const valid = await service.sendConfiguration({
      deviceId: 'home_device_1'
    }, {
      ssid: 'Home WiFi',
      password: 'secret-password',
      serverAddress: 'wss://openx-server.onrender.com/ws'
    });

    assert.equal(invalid.valid, false);
    assert.equal(valid.success, true);
    assert.equal(valid.credentialsStored, false);
    assert.equal(Object.prototype.hasOwnProperty.call(valid, 'password'), false);
  });

  it('runs the complete desktop onboarding state flow', async function() {
    const manager = new HomeOnboardingManager();
    manager.startDiscovery();
    manager.addDiscoveredDevice({
      deviceId: 'home_device_1',
      deviceName: 'OpenX Home Device',
      firmwareVersion: '1.0.0',
      protocolVersion: 'openx-home-v1'
    });

    const started = manager.startOnboarding('home_device_1');
    const configured = await manager.sendConfiguration({
      sessionId: started.session.sessionId,
      ssid: 'Home WiFi',
      password: 'secret-password',
      serverAddress: 'wss://openx-server.onrender.com/ws'
    });
    const connected = manager.waitForConnection(started.session.sessionId);
    const paired = await manager.approvePairing({
      sessionId: started.session.sessionId,
      ownerId: 'owner_1'
    });
    const finished = manager.finish(started.session.sessionId);

    assert.equal(started.success, true);
    assert.equal(configured.success, true);
    assert.equal(connected.success, true);
    assert.equal(paired.success, true);
    assert.equal(finished.success, true);
    assert.equal(finished.session.state, 'finished');
    assert.equal(finished.devices[0].pairingStatus, 'paired');
  });

  it('migrates a Bluetooth setup session to the real server device ID', async function() {
    const manager = new HomeOnboardingManager({
      ownerId: 'owner_1',
      connectionWaitTimeoutMs: 1000,
      connectionPollIntervalMs: 1,
      serverClient: {
        async getHomeDevice() {
          return { success: false, code: 'unknown-home-device', message: 'Home device was not found.' };
        },
        async listHomeDevices() {
          return {
            success: true,
            devices: [{
              deviceId: 'oxd_D8CCE6F4E9D4',
              deviceName: 'OpenX Home Device',
              firmwareVersion: '0.4.0',
              protocolVersion: 'openx-home-v1',
              status: 'registered',
              connectionStatus: 'online',
              pairStatus: 'unpaired'
            }]
          };
        }
      }
    });
    manager.addDiscoveredDevice({
      deviceId: 'oxd_ble_1234abcd',
      deviceName: 'OpenX Home Device',
      discoverySource: 'bluetooth',
      transport: 'ble',
      connectionStatus: 'ble_advertising'
    });

    const started = manager.startOnboarding('oxd_ble_1234abcd');
    const configured = await manager.sendConfiguration({
      sessionId: started.session.sessionId,
      ssid: 'Home WiFi',
      password: 'secret-password',
      serverAddress: 'wss://openx-server.onrender.com/ws'
    });
    const connected = await manager.waitForConnection(started.session.sessionId);
    const realDevice = manager.discovery.getDevice('oxd_D8CCE6F4E9D4');

    assert.equal(started.success, true);
    assert.equal(configured.success, true);
    assert.equal(connected.success, true);
    assert.equal(connected.session.deviceId, 'oxd_D8CCE6F4E9D4');
    assert.equal(connected.device.deviceId, 'oxd_D8CCE6F4E9D4');
    assert.equal(connected.device.connectionStatus, 'online');
    assert.equal(realDevice.connectionStatus, 'online');
    assert.equal(manager.discovery.getDevice('oxd_ble_1234abcd'), null);
  });

  it('prevents duplicate onboarding sessions for the same device', function() {
    const manager = new HomeOnboardingManager();
    manager.addDiscoveredDevice({
      deviceId: 'home_device_1',
      deviceName: 'OpenX Home Device'
    });

    const first = manager.startOnboarding('home_device_1');
    const second = manager.startOnboarding('home_device_1');

    assert.equal(first.success, true);
    assert.equal(second.success, false);
    assert.equal(second.code, 'onboarding-in-progress');
  });

  it('keeps a locally paired device connected when reconnect refresh sees an unpaired server record', async function() {
    let approved = false;
    const manager = new HomeOnboardingManager({
      ownerId: 'owner_1',
      serverClient: {
        async getHomeDevice() {
          return {
            success: true,
            device: {
              deviceId: 'home_device_1',
              deviceName: 'Living Room Light',
              connectionStatus: 'online',
              pairStatus: 'unpaired',
              status: 'registered'
            }
          };
        }
      },
      pairing: {
        async approvePairing({ ownerId }) {
          approved = ownerId === 'owner_1';
          return { success: true, paired: true };
        }
      }
    });
    manager.discovery.addDiscoveredDevice({
      deviceId: 'home_device_1',
      deviceName: 'Living Room Light',
      connectionStatus: 'offline',
      pairingStatus: 'paired'
    }, { includePaired: true });

    const refreshed = await manager.refreshDevice('home_device_1');
    const connected = manager.discovery.getDevice('home_device_1');

    assert.equal(refreshed.success, true);
    assert.equal(refreshed.reclaimed, true);
    assert.equal(approved, true);
    assert.equal(connected.pairingStatus, 'paired');
    assert.equal(connected.connectionStatus, 'online');
  });

  it('migrates a stale Bluetooth connected-device record during reconnect', async function() {
    const manager = new HomeOnboardingManager({
      ownerId: 'owner_1',
      serverClient: {
        async getHomeDevice({ deviceId }) {
          assert.equal(deviceId, 'oxd_ble_deadbeef');
          return { success: false, code: 'unknown-home-device', message: 'Unknown home device.' };
        },
        async listHomeDevices() {
          return {
            success: true,
            devices: [{
              deviceId: 'oxd_D8CCE6F4E9D4',
              deviceName: 'OpenX Home Device',
              connectionStatus: 'online',
              pairStatus: 'paired',
              status: 'ready'
            }]
          };
        }
      }
    });
    manager.discovery.addDiscoveredDevice({
      deviceId: 'oxd_ble_deadbeef',
      deviceName: 'OpenX Home Device',
      discoverySource: 'bluetooth',
      transport: 'ble',
      connectionStatus: 'offline',
      pairingStatus: 'paired'
    }, { includePaired: true });

    const refreshed = await manager.refreshDevice('oxd_ble_deadbeef');
    const realDevice = manager.discovery.getDevice('oxd_D8CCE6F4E9D4');

    assert.equal(refreshed.success, true);
    assert.equal(refreshed.migratedFrom, 'oxd_ble_deadbeef');
    assert.equal(refreshed.reconnected, true);
    assert.equal(refreshed.device.deviceId, 'oxd_D8CCE6F4E9D4');
    assert.equal(realDevice.pairingStatus, 'paired');
    assert.equal(realDevice.connectionStatus, 'online');
    assert.equal(manager.discovery.getDevice('oxd_ble_deadbeef'), null);
  });

  it('preserves local pairing when reconnect cannot restore server ownership', async function() {
    const manager = new HomeOnboardingManager({
      ownerId: 'owner_1',
      serverClient: {
        async getHomeDevice() {
          return {
            success: true,
            device: {
              deviceId: 'home_device_1',
              deviceName: 'Living Room Light',
              connectionStatus: 'online',
              pairStatus: 'unpaired',
              status: 'registered'
            }
          };
        }
      },
      pairing: {
        async approvePairing() {
          return { success: false, code: 'pairing-unavailable', message: 'Pairing unavailable.' };
        }
      }
    });
    manager.discovery.addDiscoveredDevice({
      deviceId: 'home_device_1',
      deviceName: 'Living Room Light',
      connectionStatus: 'offline',
      pairingStatus: 'paired'
    }, { includePaired: true });

    const refreshed = await manager.refreshDevice('home_device_1');
    const existing = manager.discovery.getDevice('home_device_1');

    assert.equal(refreshed.success, false);
    assert.equal(refreshed.code, 'home-device-reclaim-failed');
    assert.equal(existing.pairingStatus, 'paired');
    assert.equal(existing.connectionStatus, 'offline');
  });
});
