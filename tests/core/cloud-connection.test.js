const { expect } = require('chai');
const { WebSocketServer } = require('ws');
const { CloudConnectionManager } = require('../../core/cloud');

function createSilentLogger() {
  return {
    info() {},
    warn() {},
    error() {}
  };
}

function waitForEvent(emitter, event, predicate = () => true, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      emitter.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);
    const handler = payload => {
      if (!predicate(payload)) return;
      clearTimeout(timeout);
      emitter.off(event, handler);
      resolve(payload);
    };
    emitter.on(event, handler);
  });
}

function createUnsignedAccessToken(deviceId) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    type: 'access',
    ownerId: 'owner-test',
    deviceId,
    exp: Date.now() + 60000,
    jti: `${deviceId}-token`
  })}.signature`;
}

describe('CloudConnectionManager', () => {
  let server;

  afterEach(async () => {
    if (!server) return;
    for (const client of server.clients || []) {
      try {
        client.terminate();
      } catch (_) {}
    }
    await new Promise(resolve => server.close(resolve));
    server = null;
  });

  async function startRelayStub() {
    server = new WebSocketServer({ port: 0 });
    server.on('connection', socket => {
      socket.send(JSON.stringify({
        type: 'connected',
        clientId: 'desktop-test-client',
        server: 'OpenX Relay Test',
        version: '1.0.0'
      }));
    });
    await new Promise(resolve => server.once('listening', resolve));
    return `ws://127.0.0.1:${server.address().port}/ws`;
  }

  it('connects and disconnects manually without requiring local services', async () => {
    const relayUrl = await startRelayStub();
    const manager = new CloudConnectionManager({
      logger: createSilentLogger(),
      settings: { reconnectEnabled: true, heartbeatEnabled: false },
      version: 'test'
    });

    const handshakePromise = waitForEvent(manager, 'status', payload => payload.clientId === 'desktop-test-client');
    const status = await manager.connect({ relayUrl });
    expect(status.state).to.equal('Connected');
    expect(status.connected).to.equal(true);

    const handshake = await handshakePromise;
    expect(handshake.clientId).to.equal('desktop-test-client');

    const disconnected = await manager.disconnect('test-finished');
    expect(disconnected.state).to.equal('Disconnected');
    expect(disconnected.connected).to.equal(false);
    expect(disconnected.reconnectAttempts).to.equal(0);
  });

  it('normalizes http relay URLs to websocket URLs', () => {
    expect(CloudConnectionManager.normalizeRelayUrl('https://relay.example.com'))
      .to.equal('wss://relay.example.com/ws');
    expect(CloudConnectionManager.normalizeRelayUrl('http://localhost:8080/custom'))
      .to.equal('ws://localhost:8080/custom');
  });

  it('updates and removes cloud devices through correlated relay requests', async () => {
    const relayUrl = await startRelayStub();
    server.on('connection', socket => {
      socket.on('message', data => {
        const message = JSON.parse(data.toString('utf8'));
        if (message.type === 'device:update') {
          socket.send(JSON.stringify({
            type: 'device:updated',
            requestId: message.requestId,
            success: true,
            device: {
              deviceId: message.deviceId,
              friendlyName: message.friendlyName,
              ownerId: 'owner-test',
              connectionState: 'connected'
            }
          }));
        }
        if (message.type === 'device:remove') {
          socket.send(JSON.stringify({
            type: 'device:removed',
            requestId: message.requestId,
            success: true,
            device: {
              deviceId: message.deviceId
            }
          }));
        }
      });
    });
    const manager = new CloudConnectionManager({
      logger: createSilentLogger(),
      settings: { reconnectEnabled: false, heartbeatEnabled: false },
      version: 'test'
    });

    await manager.connect({ relayUrl });
    manager.pairedDevices = [{ deviceId: 'phone:001', friendlyName: 'Old Phone', ownerId: 'owner-test' }];

    const updated = await manager.updateDevice('phone:001', { friendlyName: 'New Phone' });
    expect(updated.success).to.equal(true);
    expect(manager.getStatus().pairedDevices[0].friendlyName).to.equal('New Phone');

    const removed = await manager.removeDevice('phone:001');
    expect(removed.success).to.equal(true);
    expect(manager.getStatus().pairedDevices).to.deep.equal([]);

    await manager.disconnect('test-finished');
  });

  it('tracks presence and notifications sent by the relay', async () => {
    const relayUrl = await startRelayStub();
    server.on('connection', socket => {
      socket.on('message', data => {
        const message = JSON.parse(data.toString('utf8'));
        if (message.type === 'device:register') {
          socket.send(JSON.stringify({
            type: 'device:registered',
            requestId: message.requestId,
            owner: { id: 'owner-test' },
            device: { deviceId: message.deviceId, ownerId: 'owner-test', friendlyName: 'Desktop' }
          }));
          socket.send(JSON.stringify({
            type: 'presence:subscribed',
            requestId: 'presence-test',
            presence: [{
              deviceId: message.deviceId,
              ownerId: 'owner-test',
              state: 'online',
              lastSeen: 1000
            }]
          }));
          socket.send(JSON.stringify({
            type: 'notification:new',
            notification: {
              notificationId: 'notice-1',
              ownerId: 'owner-test',
              sourceDeviceId: 'phone-test',
              destinationDeviceId: message.deviceId,
              category: 'device',
              priority: 'high',
              status: 'delivered',
              read: false,
              createdAt: 1000
            }
          }));
        }
      });
    });
    const manager = new CloudConnectionManager({
      logger: createSilentLogger(),
      settings: {
        deviceId: 'desktop-test',
        ownerId: 'owner-test',
        reconnectEnabled: false,
        heartbeatEnabled: false
      },
      version: 'test'
    });

    const presencePromise = waitForEvent(manager, 'presence', presence => presence.length === 1);
    const notificationPromise = waitForEvent(manager, 'notification', notification => notification.notificationId === 'notice-1');
    await manager.connect({ relayUrl });
    const presence = await presencePromise;
    const notification = await notificationPromise;

    expect(presence[0].state).to.equal('online');
    expect(notification.priority).to.equal('high');
    expect(manager.getStatus().notifications).to.have.length(1);

    await manager.disconnect('test-finished');
  });

  it('does not replace desktop auth with a paired phone token', () => {
    const manager = new CloudConnectionManager({
      logger: createSilentLogger(),
      settings: {
        deviceId: 'desktop-test',
        ownerId: 'owner-test',
        reconnectEnabled: false,
        heartbeatEnabled: false
      },
      version: 'test'
    });
    const desktopAuth = { accessToken: createUnsignedAccessToken('desktop-test'), refreshToken: 'desktop-refresh' };
    const phoneAuth = { accessToken: createUnsignedAccessToken('phone-test'), refreshToken: 'phone-refresh' };
    manager.device = { deviceId: 'desktop-test', ownerId: 'owner-test' };
    manager.auth = desktopAuth;

    manager.handleMessage(JSON.stringify({
      type: 'cloud-pair:paired',
      ownerId: 'owner-test',
      desktopDeviceId: 'desktop-test',
      phoneDeviceId: 'phone-test',
      auth: phoneAuth,
      devices: [{ deviceId: 'phone-test', ownerId: 'owner-test', friendlyName: 'Phone' }]
    }));

    expect(manager.auth).to.equal(desktopAuth);
    expect(manager.getStatus().authenticated).to.equal(true);
    expect(manager.getStatus().pairedDevices).to.have.length(1);
  });
});
