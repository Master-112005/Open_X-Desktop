const { expect } = require('chai');
const { WebSocket, WebSocketServer } = require('ws');
const { CloudConnectionManager, CloudE2EE } = require('../../core/cloud');

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

  it('encrypts relay packet payloads and metadata before sending', () => {
    const masterKey = CloudE2EE.generateSecret();
    const sender = new CloudConnectionManager({
      logger: createSilentLogger(),
      e2eeMasterKey: masterKey,
      settings: { heartbeatEnabled: false },
      version: 'test'
    });
    const receiver = new CloudConnectionManager({
      logger: createSilentLogger(),
      e2eeMasterKey: masterKey,
      settings: { heartbeatEnabled: false },
      version: 'test'
    });
    const packet = {
      packetId: 'packet-e2ee-1',
      protocolVersion: 1,
      packetType: 'request',
      sourceDeviceId: 'phone-test',
      destinationDeviceId: 'desktop-test',
      ownerId: 'owner-test',
      timestamp: Date.now(),
      requestId: 'request-e2ee-1',
      responseId: null,
      metadata: { feature: 'assistant-command', retryable: true },
      checksum: 'private-checksum',
      encryption: null,
      payload: {
        type: 'assistant-command',
        command: 'open downloads'
      }
    };

    const encrypted = sender.protectRelayPacket(packet);
    expect(encrypted.payload).to.deep.equal({ type: 'encrypted', scheme: CloudE2EE.SCHEME });
    expect(encrypted.metadata).to.deep.equal({ encrypted: true, retryable: true });
    expect(JSON.stringify(encrypted)).to.not.include('open downloads');
    expect(JSON.stringify(encrypted)).to.not.include('assistant-command');

    const decrypted = receiver.unprotectRelayMessage({ type: 'relay:packet', packet: encrypted });
    expect(decrypted.packet.payload.command).to.equal('open downloads');
    expect(decrypted.packet.metadata.feature).to.equal('assistant-command');
    expect(decrypted.packet.checksum).to.equal('private-checksum');
  });

  it('rejects tampered encrypted relay packets', () => {
    const masterKey = CloudE2EE.generateSecret();
    const sender = new CloudConnectionManager({
      logger: createSilentLogger(),
      e2eeMasterKey: masterKey,
      settings: { heartbeatEnabled: false },
      version: 'test'
    });
    const receiver = new CloudConnectionManager({
      logger: createSilentLogger(),
      e2eeMasterKey: masterKey,
      settings: { heartbeatEnabled: false },
      version: 'test'
    });
    const relayErrors = [];
    receiver.on('relay-error', error => relayErrors.push(error));
    const encrypted = sender.protectRelayPacket({
      packetId: 'packet-e2ee-2',
      protocolVersion: 1,
      packetType: 'request',
      sourceDeviceId: 'phone-test',
      destinationDeviceId: 'desktop-test',
      ownerId: 'owner-test',
      timestamp: Date.now(),
      requestId: 'request-e2ee-2',
      responseId: null,
      metadata: { feature: 'assistant-command' },
      checksum: null,
      encryption: null,
      payload: { type: 'assistant-command', command: 'open downloads' }
    });
    const tampered = { ...encrypted, destinationDeviceId: 'desktop-other' };

    const decrypted = receiver.unprotectRelayMessage({ type: 'relay:packet', packet: tampered });
    expect(decrypted).to.equal(null);
    expect(relayErrors).to.have.length(1);
    expect(relayErrors[0].code).to.equal('e2ee-packet-rejected');
  });

  it('queues retryable relay packets while reconnecting and flushes them after registration', () => {
    const manager = new CloudConnectionManager({
      logger: createSilentLogger(),
      settings: { heartbeatEnabled: false, retryQueueMaxItems: 2 },
      version: 'test'
    });
    const packet = {
      packetId: 'retry-packet-1',
      protocolVersion: 1,
      packetType: 'request',
      sourceDeviceId: 'phone-test',
      destinationDeviceId: 'desktop-test',
      ownerId: 'owner-test',
      timestamp: Date.now(),
      requestId: 'retry-request-1',
      responseId: null,
      metadata: { feature: 'assistant-command', retryable: true },
      checksum: null,
      encryption: null,
      payload: { type: 'assistant-command', command: 'open downloads' }
    };

    expect(manager.sendRelayPacket(packet)).to.equal(true);
    expect(manager.getStatus().reliability.retryQueueSize).to.equal(1);

    const sent = [];
    manager.socket = {
      readyState: WebSocket.OPEN,
      send(value) {
        sent.push(JSON.parse(value));
      }
    };
    manager.state = CloudConnectionManager.STATES.CONNECTED;
    const flushed = manager.flushRetryQueue();

    expect(flushed).to.equal(1);
    expect(sent).to.have.length(1);
    expect(sent[0].type).to.equal('relay:packet');
    expect(manager.getStatus().reliability.retryQueueSize).to.equal(0);
  });

  it('correlates pairing approvals and rejections with the pair request id', () => {
    const manager = new CloudConnectionManager({
      logger: createSilentLogger(),
      settings: { heartbeatEnabled: false },
      version: 'test'
    });
    const sent = [];
    manager.send = payload => {
      sent.push(payload);
      return true;
    };

    expect(manager.approvePairingRequest('pair-approve-1', { scheme: 'openx-e2ee-v1' })).to.equal(true);
    expect(manager.rejectPairingRequest('pair-reject-1')).to.equal(true);

    expect(sent[0]).to.include({
      type: 'cloud-pair:approve',
      requestId: 'pair-approve-1',
      pairRequestId: 'pair-approve-1'
    });
    expect(sent[1]).to.include({
      type: 'cloud-pair:reject',
      requestId: 'pair-reject-1',
      pairRequestId: 'pair-reject-1'
    });
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
        if (message.type === 'device:list') {
          socket.send(JSON.stringify({
            type: 'device:list',
            requestId: message.requestId,
            success: true,
            devices: [{
              deviceId: 'desktop-test',
              friendlyName: 'Laptop',
              ownerId: 'owner-test',
              connectionState: 'connected',
              pairBoxCode: 'BOX-ABC123'
            }, {
              deviceId: 'phone:002',
              friendlyName: 'Phone',
              ownerId: 'owner-test',
              connectionState: 'offline',
              pairBoxCode: 'BOX-ABC123'
            }],
            pairs: [{
              boxCode: 'BOX-ABC123',
              deviceIds: ['desktop-test', 'phone:002']
            }]
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

    const listed = await manager.listDevices();
    expect(listed.devices).to.have.length(2);
    expect(manager.getStatus().pairedDevices.map(device => device.pairBoxCode)).to.deep.equal(['BOX-ABC123', 'BOX-ABC123']);

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

  it('decrypts protected phone notifications before emitting them', async () => {
    const masterKey = CloudE2EE.generateSecret();
    const manager = new CloudConnectionManager({
      logger: createSilentLogger(),
      e2eeMasterKey: masterKey,
      settings: {
        deviceId: 'desktop-test',
        ownerId: 'owner-test',
        reconnectEnabled: false,
        heartbeatEnabled: false
      },
      version: 'test'
    });
    manager.device = { deviceId: 'desktop-test', ownerId: 'owner-test' };
    manager.owner = { id: 'owner-test' };
    const notificationId = 'phone-notice-1';
    const envelope = CloudE2EE.encryptJson(masterKey, {
      appName: 'WhatsApp',
      packageName: 'com.whatsapp',
      title: 'Rakesh',
      message: 'Call me back',
      details: {
        appName: 'WhatsApp',
        packageName: 'com.whatsapp',
        groupKey: 'com.whatsapp'
      },
      category: 'phone',
      priority: 'high',
      timestamp: 2000,
      repeatCount: 1
    }, {
      domain: 'phone-notification',
      context: {
        ownerId: 'owner-test',
        sourceDeviceId: 'phone-test',
        destinationDeviceId: 'desktop-test',
        notificationId
      },
      aad: {
        ownerId: 'owner-test',
        sourceDeviceId: 'phone-test',
        destinationDeviceId: 'desktop-test',
        notificationId
      }
    });

    const notificationPromise = waitForEvent(manager, 'notification', notification => notification.notificationId === notificationId);
    manager.handleMessage(JSON.stringify({
      type: 'notification:new',
      notification: {
        notificationId,
        ownerId: 'owner-test',
        sourceDeviceId: 'phone-test',
        destinationDeviceId: 'desktop-test',
        category: 'phone',
        priority: 'normal',
        title: 'Encrypted phone notification',
        message: 'OpenX protected this notification.',
        details: { encrypted: true },
        encryptedContent: {
          encrypted: true,
          scheme: 'openx-e2ee-v1',
          envelope
        },
        createdAt: 2000
      }
    }));
    const notification = await notificationPromise;

    expect(notification.appName).to.equal('WhatsApp');
    expect(notification.title).to.equal('Rakesh');
    expect(notification.message).to.equal('Call me back');
    expect(notification.details.decrypted).to.equal(true);
    expect(manager.getStatus().notifications[0].appName).to.equal('WhatsApp');
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
