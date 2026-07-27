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
    const uiEvents = [];
    manager.on('assistant-command', event => uiEvents.push({ type: 'command', event }));
    manager.on('assistant-result', event => uiEvents.push({ type: 'result', event }));

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
    assert.equal(uiEvents.length, 2);
    assert.equal(uiEvents[0].type, 'command');
    assert.equal(uiEvents[0].event.command, 'open downloads');
    assert.equal(uiEvents[1].type, 'result');
    assert.equal(uiEvents[1].event.result.response, 'Choose a folder.');
    assert.equal(uiEvents[1].event.responseType, 'clarification');
  });

  it('keeps cloud assistant responses small enough for the relay packet limit', async () => {
    const connection = createConnection();
    const manager = new CloudCommandManager({
      connectionManager: connection,
      executionTimeoutMs: 1000,
      commandRouter: {
        async route() {
          return {
            success: true,
            response: 'Found matching files.',
            intent: 'file.search',
            data: {
              choices: Array.from({ length: 20 }, (_, index) => ({
                index: index + 1,
                title: `Very long file result ${index + 1} ${'x'.repeat(2000)}`,
                path: `C:\\Users\\rakes\\Documents\\${'nested\\'.repeat(100)}file-${index + 1}.txt`,
                entities: {
                  selectedPath: `C:\\Users\\rakes\\Documents\\${'nested\\'.repeat(100)}file-${index + 1}.txt`
                }
              })),
              entries: Array.from({ length: 100 }, (_, index) => ({
                name: `entry-${index}-${'y'.repeat(1000)}`,
                path: `C:\\large\\${'folder\\'.repeat(100)}entry-${index}.txt`,
                snippet: 'z'.repeat(2000)
              })),
              rawScan: 'private-large-debug-payload'.repeat(2000)
            }
          };
        }
      },
      logger: { info() {}, warn() {}, error() {} }
    });

    manager.handleRelayPacket(createPacket());
    await new Promise(resolve => setTimeout(resolve, 20));

    assert.equal(connection.sent.length, 1);
    const packet = connection.sent[0];
    assert.ok(Buffer.byteLength(JSON.stringify(packet), 'utf8') < 32768);
    assert.equal(packet.payload.payload.response, 'Found matching files.');
    assert.equal(packet.payload.payload.intent, 'file.search');
    assert.equal(packet.payload.payload.data.choices.length, 8);
    assert.equal(packet.payload.payload.data.entries.length, 8);
    assert.equal(packet.payload.payload.data.rawScan, undefined);
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

  it('ignores cloud file transfer control packets instead of returning assistant errors', async () => {
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
    const packet = createPacket({
      type: 'cloud-file-transfer',
      action: 'chunk-ack',
      transferId: 'cloud_transfer_1',
      nextChunkIndex: 1
    });
    packet.packet.metadata = { feature: 'cloud-file-transfer', action: 'chunk-ack' };
    packet.packet.requestId = 'cloud_transfer_1:chunk-ack:0:request_1';

    const result = manager.handleRelayPacket(packet);
    await new Promise(resolve => setTimeout(resolve, 20));

    assert.equal(result.code, 'ignored-file-transfer');
    assert.equal(executed, false);
    assert.equal(connection.sent.length, 0);
  });

  it('routes remote-control packets to the remote handler and returns active targets', async () => {
    const connection = createConnection();
    let handledPayload = null;
    const manager = new CloudCommandManager({
      connectionManager: connection,
      executionTimeoutMs: 1000,
      commandRouter: {
        async route() {
          return { success: false };
        }
      },
      remoteControlHandler: async (payload) => {
        handledPayload = payload;
        return {
          success: true,
          data: {
            targets: [
              {
                id: 'youtube',
                label: 'YouTube',
                kind: 'media',
                processName: 'chrome',
                windowTitle: 'Dulander song - YouTube - Google Chrome',
                tabTitle: 'Dulander song - YouTube',
                active: true,
                source: 'browser-tab'
              }
            ]
          }
        };
      },
      logger: { info() {}, warn() {}, error() {} }
    });
    const packet = createPacket({
      type: 'remote-control',
      action: 'listTargets'
    });
    packet.packet.metadata = { feature: 'remote-control' };

    const accepted = manager.handleRelayPacket(packet);
    await new Promise(resolve => setTimeout(resolve, 20));

    assert.equal(accepted.accepted, true);
    assert.equal(handledPayload.action, 'listTargets');
    assert.equal(connection.sent.length, 1);
    assert.equal(connection.sent[0].packetType, 'response');
    assert.equal(connection.sent[0].metadata.feature, 'remote-control');
    assert.equal(connection.sent[0].payload.responseType, 'remote-control');
    assert.equal(connection.sent[0].payload.payload.data.targets[0].id, 'youtube');
  });
});
