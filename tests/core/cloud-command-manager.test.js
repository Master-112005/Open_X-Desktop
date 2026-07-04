const { strict: assert } = require('assert');
const EventEmitter = require('events');
const { CloudCommandManager } = require('../../core/cloud');

function createConnection(overrides = {}) {
  const sent = [];
  const connection = new EventEmitter();
  connection.isConnected = () => overrides.connected !== false;
  connection.getStatus = () => ({
    device: { deviceId: 'desktop_1' },
    owner: { id: 'owner_1' }
  });
  connection.sendRelayPacket = packet => {
    sent.push(packet);
    return true;
  };
  connection.sent = sent;
  return connection;
}

function createPacket(payload = {}) {
  return {
    type: 'relay:packet',
    packet: {
      packetId: 'packet_1',
      protocolVersion: 1,
      packetType: 'request',
      sourceDeviceId: 'phone_1',
      destinationDeviceId: 'desktop_1',
      ownerId: 'owner_1',
      timestamp: Date.now(),
      requestId: 'request_1',
      metadata: { feature: 'assistant-command' },
      checksum: null,
      encryption: null,
      payload: {
        type: 'assistant-command',
        command: 'open downloads',
        deviceName: 'Phone',
        ...payload
      }
    }
  };
}

describe('CloudCommandManager', () => {
  it('routes cloud assistant commands through the existing phone command pipeline and preserves structured responses', async () => {
    const connection = createConnection();
    let routedCommand = '';
    let routedOptions = null;
    const manager = new CloudCommandManager({
      connectionManager: connection,
      executionTimeoutMs: 1000,
      commandRouter: {
        async route(command, options) {
          routedCommand = command;
          routedOptions = options;
          return {
            success: true,
            response: 'Choose a folder.',
            needsClarification: true,
            data: {
              choices: [
                { index: 1, title: 'Downloads', path: 'C:\\Users\\rakes\\Downloads' }
              ]
            }
          };
        }
      },
      logger: { info() {}, warn() {}, error() {} }
    });

    manager.handleRelayPacket(createPacket());
    await new Promise(resolve => setTimeout(resolve, 20));

    assert.equal(routedCommand, 'open downloads');
    assert.equal(routedOptions.phoneContext.deviceId, 'phone_1');
    assert.equal(routedOptions.phoneContext.cloud, true);
    assert.equal(connection.sent.length, 1);
    assert.equal(connection.sent[0].packetType, 'response');
    assert.equal(connection.sent[0].payload.status, 'completed');
    assert.equal(connection.sent[0].payload.responseType, 'clarification');
    assert.equal(connection.sent[0].payload.payload.data.choices[0].title, 'Downloads');
  });

  it('rejects invalid owner packets before assistant execution', async () => {
    const connection = createConnection();
    let executed = false;
    const manager = new CloudCommandManager({
      connectionManager: connection,
      commandRouter: {
        async route() {
          executed = true;
          return { success: true };
        }
      },
      logger: { info() {}, warn() {}, error() {} }
    });
    const packet = createPacket();
    packet.packet.ownerId = 'owner_2';

    manager.handleRelayPacket(packet);
    await new Promise(resolve => setTimeout(resolve, 20));

    assert.equal(executed, false);
    assert.equal(connection.sent.length, 1);
    assert.equal(connection.sent[0].packetType, 'error');
    assert.equal(connection.sent[0].payload.error.code, 'owner-violation');
  });
});
