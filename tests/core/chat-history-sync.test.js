const assert = require('assert');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { History } = require('../../core/chat');

describe('OpenX Chat trusted-device history synchronization', () => {
  it('stores coordination metadata under OpenX_Data and rejects plaintext chunks', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'openx-chat-history-sync-'));
    try {
      const config = new History.HistorySynchronizationConfiguration({
        dataRoot: directory,
        apiBaseUrl: 'http://127.0.0.1:8090',
        storagePath: path.join(directory, 'chat-history-sync.json')
      });
      const storage = new History.HistorySynchronizationStorage({ config });
      const transferEngine = new History.HistoryTransferEngine({ config, storage });
      const manifest = transferEngine.createEncryptedExportManifest({
        accountId: 'acc_test',
        deviceId: 'dev_test',
        estimatedRecords: 10,
        highestSequence: 8,
        integrityHash: 'sha256:test'
      });
      const transfer = await transferEngine.startTransfer({ transferId: 'hlocaltransfer_test' });

      await assert.rejects(
        () => transferEngine.recordEncryptedChunk({
          transferId: transfer.transferId,
          chunkHash: 'sha256:chunk',
          message: 'plaintext should not enter the transfer engine'
        }),
        /encrypted chunks only/
      );

      assert.equal(manifest.containsPlaintext, false);
      assert.equal(transfer.historyStoredOnServer, false);
      assert.equal(config.storagePath, path.join(directory, 'chat-history-sync.json'));
      assert.equal(JSON.stringify(storage.state).includes('plaintext should not enter'), false);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });

  it('requests history coordination from the server without receiving history content', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'openx-chat-history-manager-'));
    const calls = [];
    try {
      const manager = new History.HistorySynchronizationManager({
        apiBaseUrl: 'http://127.0.0.1:8090',
        storagePath: path.join(directory, 'chat-history-sync.json'),
        fetchImpl: async (url, request) => {
          calls.push({ url, request });
          return {
            ok: true,
            async json() {
              return {
                ok: true,
                data: {
                  syncRequestId: 'hsync_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                  accountId: 'acc_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                  requestingDeviceId: 'dev_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                  sourceDeviceId: null,
                  status: 'WaitingForSource',
                  available: false,
                  historyStoredOnServer: false,
                  serverCanDecrypt: false,
                  manifestSummary: {}
                }
              };
            }
          };
        }
      });
      const result = await manager.requestSynchronization({
        accountId: 'acc_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        deviceId: 'dev_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        manifest: { estimatedRecords: 20 }
      });

      assert.equal(result.historyStoredOnServer, false);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url.endsWith('/history-sync/request'), true);
      assert.equal(JSON.stringify(calls[0].request).includes('ConversationHistory'), false);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });
});
