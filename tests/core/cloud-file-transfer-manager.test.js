const { strict: assert } = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const EventEmitter = require('events');
const { resolveDocumentsDirectory } = require('../../core/assistant/Data');
const { CloudFileTransferManager, CloudFileTransferProtocol } = require('../../core/cloud');

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

async function waitFor(predicate, timeoutMs = 1000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.ok(predicate(), 'condition was not met before timeout');
}

describe('CloudFileTransferManager', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-cloud-transfer-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('stores received files in Documents OpenX and temp chunks in the managed data root', () => {
    const manager = new CloudFileTransferManager({
      config: { app: { dataDir: tempDir } },
      logger: { info() {}, warn() {}, error() {} }
    });

    assert.equal(manager.getReceiveDirectory(), path.join(resolveDocumentsDirectory(), 'OpenX'));
    assert.equal(manager.getTempDirectory(), path.join(tempDir, 'runtime', 'cloud-transfer'));
  });

  it('sends metadata before chunks and waits for receiver acceptance', async () => {
    const source = path.join(tempDir, 'hello.txt');
    fs.writeFileSync(source, 'hello cloud transfer');
    const connection = createConnection();
    const manager = new CloudFileTransferManager({
      connectionManager: connection,
      chunkBytes: 8,
      logger: { info() {}, warn() {}, error() {} }
    });

    const pending = manager.sendFileToDevice('phone_1', source);
    await waitFor(() => connection.sent.length === 1);
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

    await waitFor(() => connection.sent.length >= 2);
    assert.equal(connection.sent[1].payload.action, 'chunk');
    assert.equal(connection.sent[1].payload.chunkIndex, 0);
    manager.cancelTransfer(connection.sent[0].payload.transferId, 'test-finished');
    await assert.rejects(() => pending, /test-finished/);
  });

  it('can start a transfer without waiting for final receiver completion', async () => {
    const source = path.join(tempDir, 'resume.docx');
    fs.writeFileSync(source, 'resume file contents');
    const connection = createConnection();
    const manager = new CloudFileTransferManager({
      connectionManager: connection,
      chunkBytes: 8,
      logger: { info() {}, warn() {}, error() {} }
    });

    const started = await manager.startFileToDevice('phone_1', source);

    assert.equal(connection.sent.length, 1);
    assert.equal(connection.sent[0].payload.action, 'metadata');
    assert.equal(started.fileName, 'resume.docx');
    assert.equal(started.state, 'pending');
    assert.equal(typeof started.completion?.then, 'function');

    manager.cancelTransfer(started.transferId, 'test-finished');
    await assert.rejects(() => started.completion, /test-finished/);
  });

  it('streams outgoing desktop chunks without retaining the whole file in memory', async () => {
    const source = path.join(tempDir, 'large.bin');
    fs.writeFileSync(source, Buffer.alloc(64 * 1024, 7));
    const connection = createConnection();
    const manager = new CloudFileTransferManager({
      connectionManager: connection,
      chunkBytes: 4096,
      logger: { info() {}, warn() {}, error() {} }
    });

    const pending = manager.sendFileToDevice('phone_1', source);
    await waitFor(() => connection.sent.length === 1);
    const transferId = connection.sent[0].payload.transferId;
    const transfer = manager.outgoing.get(transferId);
    assert.equal(Buffer.isBuffer(transfer.data), false);
    assert.equal(transfer.sourcePath, source);
    assert.ok(transfer.fileHandle);

    manager.handleRelayPacket({
      packet: {
        payload: {
          type: 'cloud-file-transfer',
          action: 'accept',
          transferId,
          nextChunkIndex: 0
        }
      }
    });

    await waitFor(() => connection.sent.length >= 2);
    assert.equal(connection.sent[1].payload.action, 'chunk');
    assert.equal(connection.sent[1].payload.chunkSize, 4096);
    manager.cancelTransfer(transferId, 'test-finished');
    await assert.rejects(() => pending, /test-finished/);
  });

  it('cleans up outgoing file handles when relay metadata send fails', async () => {
    const source = path.join(tempDir, 'failed.bin');
    fs.writeFileSync(source, Buffer.alloc(1024, 3));
    const connection = createConnection();
    connection.sendRelayPacket = () => false;
    const manager = new CloudFileTransferManager({
      connectionManager: connection,
      chunkBytes: 512,
      logger: { info() {}, warn() {}, error() {} }
    });

    await assert.rejects(
      () => manager.sendFileToDevice('phone_1', source),
      /could not send/
    );
    assert.equal(manager.outgoing.size, 0);
  });

  it('fails an outgoing transfer immediately when the relay rejects a control packet', async () => {
    const source = path.join(tempDir, 'offline.bin');
    fs.writeFileSync(source, Buffer.alloc(1024, 5));
    const connection = createConnection();
    const manager = new CloudFileTransferManager({
      connectionManager: connection,
      chunkBytes: 512,
      logger: { info() {}, warn() {}, error() {} }
    });
    const failures = [];
    manager.on('failed', event => failures.push(event));

    const pending = manager.sendFileToDevice('phone_1', source);
    await waitFor(() => connection.sent.length === 1);
    const requestId = connection.sent[0].requestId;
    const transferId = connection.sent[0].payload.transferId;
    assert.equal(manager.outgoing.has(transferId), true);
    assert.equal(manager.controlRequests.has(requestId), true);

    manager.handleRelayError({
      type: 'relay:error',
      packetId: connection.sent[0].packetId,
      requestId,
      code: 'destination-offline',
      message: 'Destination Offline'
    });

    await assert.rejects(() => pending, /Destination Offline/);
    assert.equal(manager.outgoing.size, 0);
    assert.equal(manager.controlRequests.size, 0);
    assert.equal(failures.length, 1);
    assert.equal(failures[0].transferId, transferId);
    assert.equal(failures[0].reason, 'destination-offline');
  });

  it('receives chunks only after explicit acceptance and verifies final hash', async () => {
    const connection = createConnection();
    const manager = new CloudFileTransferManager({
      connectionManager: connection,
      logger: { info() {}, warn() {}, error() {} },
      receiveDirectory: path.join(tempDir, 'received'),
      tempDirectory: path.join(tempDir, 'tmp')
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

  it('catches asynchronous transfer handler failures and cleans the affected transfer', async () => {
    const connection = createConnection();
    const manager = new CloudFileTransferManager({
      connectionManager: connection,
      logger: { info() {}, warn() {}, error() {} },
      receiveDirectory: path.join(tempDir, 'received'),
      tempDirectory: path.join(tempDir, 'tmp')
    });
    const transferId = 'cloud-test-async-failure';
    const data = Buffer.from('phone chunk');
    const sha256 = crypto.createHash('sha256').update(data).digest('hex');
    const failures = [];
    manager.on('failed', event => failures.push(event));

    await manager.handleMetadata({
      sourceDeviceId: 'phone_1',
      destinationDeviceId: 'desktop_1',
      ownerId: 'owner_1'
    }, {
      type: 'cloud-file-transfer',
      action: 'metadata',
      transferId,
      fileName: 'broken.txt',
      fileSize: data.length,
      sha256,
      chunkCount: 1
    });
    manager.acceptTransfer(transferId);
    manager.handleChunk = async () => {
      throw new Error('forced async failure');
    };

    manager.handleRelayPacket({
      packet: {
        sourceDeviceId: 'phone_1',
        destinationDeviceId: 'desktop_1',
        ownerId: 'owner_1',
        payload: {
          type: 'cloud-file-transfer',
          action: 'chunk',
          transferId,
          chunkIndex: 0,
          data: data.toString('base64'),
          sha256
        }
      }
    });

    await waitFor(() => failures.length === 1);
    assert.equal(manager.incoming.size, 0);
    assert.equal(failures[0].transferId, transferId);
    assert.equal(failures[0].reason, 'transfer-handler-failed');
  });

  it('keeps relay packet chunks below the configured packet limit', async () => {
    const protocol = new CloudFileTransferProtocol();
    assert.ok(12 * 1024 < protocol.constructor.DEFAULT_CHUNK_BYTES);
  });
});
