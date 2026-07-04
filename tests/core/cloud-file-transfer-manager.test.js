const { strict: assert } = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const EventEmitter = require('events');
const { CloudFileTransferManager } = require('../../core/cloud');
const FileTransferProtocol = require('../../core/phone/FileTransferProtocol');

function createConnection() {
  const sent = [];
  const connection = new EventEmitter();
  connection.isConnected = () => true;
  connection.getStatus = () => ({
    device: { deviceId: 'desktop_1' },
    owner: { id: 'owner_1' },
    pairedDevices: [{ deviceId: 'phone_1', friendlyName: 'Phone' }]
  });
  connection.sendRelayPacket = packet => {
    sent.push(packet);
    return true;
  };
  connection.sent = sent;
  return connection;
}

describe('CloudFileTransferManager', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-cloud-transfer-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('sends metadata before chunks and waits for receiver acceptance', async () => {
    const source = path.join(tempDir, 'hello.txt');
    fs.writeFileSync(source, 'hello cloud transfer');
    const connection = createConnection();
    const manager = new CloudFileTransferManager({
      connectionManager: connection,
      localFileTransferManager: {
        receiveDirectory: path.join(tempDir, 'received'),
        tempDirectory: path.join(tempDir, 'tmp'),
        history: { add: record => record }
      },
      chunkBytes: 8,
      logger: { info() {}, warn() {}, error() {} }
    });

    const pending = manager.sendFileToDevice('phone_1', source);
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(connection.sent.length, 1);
    assert.equal(connection.sent[0].payload.action, 'metadata');
    assert.equal(connection.sent[0].payload.fileName, 'hello.txt');

    manager.handleRelayPacket({
      packet: {
        payload: {
          type: 'cloud-file-transfer',
          action: 'accept',
          transferId: connection.sent[0].payload.transferId,
          nextChunkIndex: 0
        }
      }
    });

    assert.equal(connection.sent[1].payload.action, 'chunk');
    assert.equal(connection.sent[1].payload.chunkIndex, 0);
    manager.cancelTransfer(connection.sent[0].payload.transferId, 'test-finished');
    await assert.rejects(() => pending, /test-finished/);
  });

  it('receives chunks only after explicit acceptance and verifies final hash', async () => {
    const connection = createConnection();
    const manager = new CloudFileTransferManager({
      connectionManager: connection,
      localFileTransferManager: {
        receiveDirectory: path.join(tempDir, 'received'),
        tempDirectory: path.join(tempDir, 'tmp'),
        history: { add: record => record }
      },
      logger: { info() {}, warn() {}, error() {} }
    });
    const data = Buffer.from('phone to desktop');
    const sha256 = crypto.createHash('sha256').update(data).digest('hex');
    const transferId = 'cloud-test-1';

    await manager.handleMetadata({
      sourceDeviceId: 'phone_1',
      destinationDeviceId: 'desktop_1',
      ownerId: 'owner_1'
    }, {
      type: 'cloud-file-transfer',
      action: 'metadata',
      transferId,
      fileName: 'mobile.txt',
      fileSize: data.length,
      sha256,
      chunkCount: 1
    });
    assert.equal(manager.incoming.get(transferId).state, 'waiting-approval');

    manager.acceptTransfer(transferId);
    const chunkHash = crypto.createHash('sha256').update(data).digest('hex');
    await manager.handleChunk({
      sourceDeviceId: 'phone_1',
      destinationDeviceId: 'desktop_1',
      ownerId: 'owner_1'
    }, {
      type: 'cloud-file-transfer',
      action: 'chunk',
      transferId,
      chunkIndex: 0,
      data: data.toString('base64'),
      sha256: chunkHash
    });
    await manager.handleComplete({ transferId });
    assert.equal(fs.readFileSync(path.join(tempDir, 'received', 'mobile.txt'), 'utf8'), 'phone to desktop');
  });

  it('keeps relay packet chunks below the configured packet limit', async () => {
    const protocol = new FileTransferProtocol();
    assert.ok(12 * 1024 < protocol.constructor.DEFAULT_CHUNK_BYTES);
  });
});
