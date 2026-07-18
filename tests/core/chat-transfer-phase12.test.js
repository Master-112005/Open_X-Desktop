const assert = require('assert');
const crypto = require('crypto');
const { TransferManager } = require('../../core/chat/transfer');

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(32).toString('hex')}`;
}

function ok(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return { ok: true, data };
    }
  };
}

describe('OpenX Chat Desktop File Transfer', () => {
  it('encrypts before upload, downloads ciphertext, decrypts locally, and ACKs cleanup', async () => {
    const uploadedBodies = [];
    let serverRecord = null;
    let acked = false;
    const fetchImpl = async (url, options = {}) => {
      const route = new URL(url).pathname;
      if (route === '/file/upload') {
        const body = JSON.parse(options.body);
        uploadedBodies.push(body);
        serverRecord = {
          transfer: {
            transferId: id('trn'),
            fileId: id('file'),
            relationshipId: body.relationshipId,
            senderAccountId: body.senderAccountId,
            recipientAccountId: body.recipientAccountId,
            senderDeviceId: body.senderDeviceId,
            recipientDeviceId: body.recipientDeviceId,
            blobToken: id('blob'),
            fileType: 'PDF',
            fileCategory: 'Document',
            fileName: body.fileName,
            mimeType: body.mimeType,
            originalSize: body.originalSize,
            encryptedSize: body.encryptedSize,
            checksum: body.checksum,
            hash: body.hash,
            originalHash: body.originalHash,
            encryptionVersion: body.encryptionVersion,
            encryption: body.encryption,
            compression: body.compression,
            status: 'Waiting',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60000).toISOString(),
            metadata: body.metadata
          },
          encryptedBlob: body.encryptedBlob
        };
        return ok({ transfer: serverRecord.transfer, duplicate: false, thumbnail: null }, 201);
      }
      if (route.startsWith('/file/download/')) {
        return ok({
          transfer: serverRecord.transfer,
          encryptedBlob: serverRecord.encryptedBlob,
          encryptedSize: serverRecord.transfer.encryptedSize,
          hash: serverRecord.transfer.hash,
          checksum: serverRecord.transfer.checksum,
          thumbnail: null
        });
      }
      if (route === '/file/ack') {
        acked = true;
        return ok({ transfer: { ...serverRecord.transfer, status: 'Completed' }, blobDeleted: true });
      }
      throw new Error(`Unexpected route ${route}`);
    };
    const manager = new TransferManager({
      config: { apiBaseUrl: 'http://chat.test' },
      fetchImpl,
      cryptoConfig: { storageBackend: {} }
    });
    const plaintext = Buffer.from('important encrypted document', 'utf8');
    const upload = await manager.startTransfer({
      relationshipId: id('rel'),
      senderAccountId: id('acc'),
      recipientAccountId: id('acc'),
      senderDeviceId: id('dev'),
      recipientDeviceId: id('dev'),
      fileName: 'report.pdf',
      mimeType: 'application/pdf',
      bytes: plaintext
    });
    const download = await manager.download({
      blobToken: upload.transfer.blobToken,
      localKey: upload.localKey
    });

    assert.equal(uploadedBodies.length, 1);
    assert.equal(uploadedBodies[0].fileKey, undefined);
    assert.equal(uploadedBodies[0].plaintext, undefined);
    assert.notEqual(uploadedBodies[0].encryptedBlob, plaintext.toString('utf8'));
    assert.deepEqual(download.plaintext, plaintext);
    assert.equal(acked, true);
  });

  it('rejects blocked extensions locally', async () => {
    const manager = new TransferManager({
      config: { apiBaseUrl: 'http://chat.test' },
      fetchImpl: async () => ok({}),
      cryptoConfig: { storageBackend: {} }
    });
    await assert.rejects(() => manager.startTransfer({
      relationshipId: id('rel'),
      senderAccountId: id('acc'),
      recipientAccountId: id('acc'),
      senderDeviceId: id('dev'),
      recipientDeviceId: id('dev'),
      fileName: 'setup.exe',
      mimeType: 'application/octet-stream',
      bytes: Buffer.from('blocked')
    }), /not allowed/);
  });

  it('rejects MIME types that do not match supported extensions', async () => {
    const manager = new TransferManager({
      config: { apiBaseUrl: 'http://chat.test' },
      fetchImpl: async () => ok({}),
      cryptoConfig: { storageBackend: {} }
    });
    await assert.rejects(() => manager.startTransfer({
      relationshipId: id('rel'),
      senderAccountId: id('acc'),
      recipientAccountId: id('acc'),
      senderDeviceId: id('dev'),
      recipientDeviceId: id('dev'),
      fileName: 'notes.pdf',
      mimeType: 'text/plain',
      bytes: Buffer.from('not a pdf')
    }), /MIME type/);
  });
});
