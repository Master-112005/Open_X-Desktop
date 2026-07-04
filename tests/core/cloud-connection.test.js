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
});
