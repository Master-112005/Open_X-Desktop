const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Assistant Data Root', function() {
  let dataRoot;

  before(function() {
    dataRoot = require('../../core/assistant/Data');
  });

  it('should default assistant-owned data to OpenX_Data', function() {
    const paths = dataRoot.buildDataPaths({});

    assert.equal(path.basename(paths.root), 'OpenX_Data');
    assert.equal(paths.settingsPath, path.join(paths.root, 'settings.json'));
    assert.equal(paths.assistantChatHistoryPath, path.join(paths.root, 'assistant-chat-history.json'));
    assert.equal(paths.chatAccountPath, path.join(paths.root, 'chat-account.json'));
    assert.equal(paths.chatDevicePath, path.join(paths.root, 'chat-device.json'));
    assert.equal(paths.chatConversationsPath, path.join(paths.root, 'chat-conversations.json'));
    assert.equal(paths.chatMessagesPath, path.join(paths.root, 'chat-messages.json'));
    assert.equal(paths.chatMailboxSequencesPath, path.join(paths.root, 'chat-mailbox-sequences.json'));
    assert.equal(paths.chatSyncCursorsPath, path.join(paths.root, 'chat-sync-cursors.json'));
    assert.equal(paths.chatHistorySyncPath, path.join(paths.root, 'chat-history-sync.json'));
    assert.equal(paths.chatMultiDevicePath, path.join(paths.root, 'chat-multi-device.json'));
    assert.equal(paths.chatFileTransfersPath, path.join(paths.root, 'chat-file-transfers.json'));
    assert.equal(paths.chatCryptoSecretsPath, path.join(paths.root, 'chat-crypto-secrets.json'));
    assert.equal(paths.chatRequestNicknamesPath, path.join(paths.root, 'chat-request-nicknames.json'));
    assert.equal(paths.uiStatePath, path.join(paths.root, 'ui-state.json'));
    assert.equal(paths.learningPath, path.join(paths.root, 'learning.json'));
    assert.equal(paths.schedulesPath, path.join(paths.root, 'schedules.json'));
    assert.equal(paths.plannerPath, path.join(paths.root, 'planner.json'));
    assert.equal(paths.screenshotsDir, path.join(paths.root, 'screenshots'));
    assert.equal(paths.learningDir, path.join(paths.root, 'learning'));
    assert.equal(paths.logsDir, path.join(paths.root, 'logs'));
    assert.equal(paths.electronProfileDir, path.join(paths.root, 'runtime', 'electron-profile'));
    assert.equal(paths.mediaProfileDir, path.join(paths.root, 'runtime', 'chrome-media-profile'));
    assert.equal(paths.cloudDir, path.join(paths.root, 'cloud'));
    assert.equal(paths.cloudReceivedDir, path.join(dataRoot.resolveDocumentsDirectory(), 'OpenX'));
    assert.equal(paths.cloudTempDir, path.join(paths.root, 'runtime', 'cloud-transfer'));
    assert.equal(paths.visualMemoryDir, path.join(paths.root, 'visual-memory'));
    assert.equal(paths.visualMemoryDatabasePath, path.join(paths.visualMemoryDir, 'visual-memory-db.json'));
    assert.equal(paths.visualMemoryThumbnailDir, path.join(paths.visualMemoryDir, 'thumbnails'));
    assert.equal(paths.legacyPhoneDir, undefined);
  });

  it('should resolve received files under the active Documents folder', function() {
    const originalUserProfile = process.env.USERPROFILE;
    const tempProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-documents-profile-'));
    const documentsDir = path.join(tempProfile, 'Documents');
    fs.mkdirSync(documentsDir, { recursive: true });

    try {
      process.env.USERPROFILE = tempProfile;
      const paths = dataRoot.buildDataPaths({});

      assert.equal(paths.cloudReceivedDir, path.join(documentsDir, 'OpenX'));
    } finally {
      if (originalUserProfile === undefined) delete process.env.USERPROFILE;
      else process.env.USERPROFILE = originalUserProfile;
      fs.rmSync(tempProfile, { recursive: true, force: true });
    }
  });

  it('should keep managed paths under a configured data root', function() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-data-root-'));
    const paths = dataRoot.ensureDataRoot({ app: { dataDir: tempDir } });

    assert.equal(paths.root, tempDir);
    assert.ok(fs.existsSync(paths.root));
    assert.ok(fs.existsSync(paths.logsDir));
    assert.ok(fs.existsSync(paths.learningDir));
    assert.ok(fs.existsSync(paths.runtimeDir));
    assert.ok(fs.existsSync(paths.electronProfileDir));
    assert.ok(fs.existsSync(paths.cacheDir));
    assert.ok(fs.existsSync(paths.mediaProfileDir));
    assert.ok(fs.existsSync(paths.screenshotsDir));
    assert.ok(fs.existsSync(paths.cloudDir));
    assert.ok(fs.existsSync(paths.cloudReceivedDir));
    assert.ok(fs.existsSync(paths.cloudTempDir));
    assert.ok(fs.existsSync(paths.visualMemoryDir));
    assert.ok(fs.existsSync(paths.visualMemoryThumbnailDir));
    assert.equal(fs.existsSync(path.join(paths.root, 'phone')), false);
  });

  it('should resolve chat module defaults under OpenX_Data or OPENX_DATA_DIR', function() {
    const chatPaths = require('../../core/chat/ChatDataPaths');
    const original = process.env.OPENX_DATA_DIR;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-chat-data-root-'));
    const dataPaths = dataRoot.buildDataPaths({ app: { dataDir: tempDir } });

    try {
      delete process.env.OPENX_DATA_DIR;
      assert.equal(chatPaths.chatDataPath('chat-device.json'), path.join(os.homedir(), 'OpenX_Data', 'chat-device.json'));
      process.env.OPENX_DATA_DIR = tempDir;
      assert.equal(chatPaths.chatDataPath('chat-device.json'), path.join(tempDir, 'chat-device.json'));
      assert.equal(
        chatPaths.chatDataPath('unused.json', { dataPaths, pathKey: 'chatDevicePath' }),
        dataPaths.chatDevicePath
      );
    } finally {
      if (original === undefined) delete process.env.OPENX_DATA_DIR;
      else process.env.OPENX_DATA_DIR = original;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should keep desktop Chat managers on the shared OpenX_Data paths', function() {
    const { ChatManager } = require('../../core/chat');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-chat-manager-data-'));
    const paths = dataRoot.buildDataPaths({ app: { dataDir: tempDir } });

    try {
      const chat = new ChatManager({
        dataPaths: paths,
        fetchImpl: async () => {
          throw new Error('Data path construction must not call the server.');
        },
        cryptoConfig: { storageBackend: {} }
      });

      assert.equal(chat.getDeviceManager().config.statePath, paths.chatDevicePath);
      assert.equal(chat.getRequestManager().config.nicknameStatePath, paths.chatRequestNicknamesPath);
      assert.equal(chat.getNicknameManager().config.nicknameStatePath, paths.chatRequestNicknamesPath);
      assert.equal(chat.getMailboxManager().config.sequenceStatePath, paths.chatMailboxSequencesPath);
      assert.equal(chat.getMessageManager().config.storagePath, paths.chatMessagesPath);
      assert.equal(chat.getMessageManager().crypto.config.storagePath, paths.chatCryptoSecretsPath);
      assert.equal(chat.getSynchronizationManager().config.storagePath, paths.chatSyncCursorsPath);
      assert.equal(chat.getHistorySynchronizationManager().config.storagePath, paths.chatHistorySyncPath);
      assert.equal(chat.getMultiDeviceManager().config.storagePath, paths.chatMultiDevicePath);
      assert.equal(chat.getTransferManager().config.storagePath, paths.chatFileTransfersPath);
      assert.equal(chat.getTransferManager().uploadManager.crypto.config.storagePath, paths.chatCryptoSecretsPath);
      assert.equal(chat.getTransferManager().downloadManager.crypto.config.storagePath, paths.chatCryptoSecretsPath);
      assert.equal(chat.getConversationManager().config.storagePath, paths.chatConversationsPath);
      assert.equal(paths.cloudReceivedDir, path.join(dataRoot.resolveDocumentsDirectory(), 'OpenX'));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should purge deprecated contact-store files from managed data', function() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-contact-purge-'));
    fs.writeFileSync(path.join(tempDir, 'contacts.json'), '{"old":true}', 'utf8');
    fs.writeFileSync(path.join(tempDir, 'contacts.json.bak'), '{"old":true}', 'utf8');

    dataRoot.ensureDataRoot({ app: { dataDir: tempDir } });

    assert.equal(fs.existsSync(path.join(tempDir, 'contacts.json')), false);
    assert.equal(fs.existsSync(path.join(tempDir, 'contacts.json.bak')), false);
  });

  it('should copy legacy assistant files into the managed data root without overwriting', function() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-data-new-'));
    const legacyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-data-legacy-'));
    fs.writeFileSync(path.join(legacyDir, 'settings.json'), '{"assistant":{"displayName":"Old"}}', 'utf8');
    fs.writeFileSync(path.join(legacyDir, 'chat-history.json'), '[{"text":"old chat","type":"user"}]', 'utf8');
    fs.writeFileSync(path.join(legacyDir, 'ui-state.json'), '{"assistantMuted":true}', 'utf8');
    fs.writeFileSync(path.join(legacyDir, 'learning.json'), '{"version":1}', 'utf8');
    fs.writeFileSync(path.join(legacyDir, 'schedules.json'), '[]', 'utf8');
    fs.writeFileSync(path.join(legacyDir, 'planner.json'), '[]', 'utf8');

    const result = dataRoot.migrateLegacyData({
      app: {
        dataDir,
        legacyDataDir: legacyDir,
        migrateLegacyData: true
      }
    });

    assert.equal(result.migrated.filter(entry => entry.reason !== 'legacy-root-quarantined').length, 6);
    assert.equal(result.migrated.some(entry => entry.reason === 'legacy-root-quarantined'), true);
    assert.ok(fs.existsSync(path.join(dataDir, 'settings.json')));
    assert.ok(fs.existsSync(path.join(dataDir, 'assistant-chat-history.json')));
    assert.equal(fs.existsSync(path.join(dataDir, 'chat-history.json')), false);
    assert.ok(fs.existsSync(path.join(dataDir, 'ui-state.json')));
    assert.ok(fs.existsSync(path.join(dataDir, 'learning.json')));
    assert.ok(fs.existsSync(path.join(dataDir, 'schedules.json')));
    assert.ok(fs.existsSync(path.join(dataDir, 'planner.json')));
    assert.equal(fs.existsSync(legacyDir), false);
    assert.ok(fs.existsSync(path.join(dataDir, 'runtime', 'legacy-data')));

    fs.mkdirSync(legacyDir, { recursive: true });
    fs.writeFileSync(path.join(legacyDir, 'settings.json'), '{"assistant":{"displayName":"Changed"}}', 'utf8');
    const second = dataRoot.migrateLegacyData({
      app: {
        dataDir,
        legacyDataDir: legacyDir,
        migrateLegacyData: true
      }
    });

    assert.equal(second.migrated.some(entry => entry.reason === 'legacy-root-quarantined'), true);
    assert.equal(fs.existsSync(legacyDir), false);
    assert.equal(dataRoot.readSecureJsonFile(path.join(dataDir, 'settings.json'), {}, {
      createIfMissing: false
    }).assistant.displayName, 'Old');
    assert.doesNotMatch(fs.readFileSync(path.join(dataDir, 'settings.json'), 'utf8'), /Old/);
  });

  it('should move legacy data directories under OpenX_Data so deleting the data root deletes old chat state too', function() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-managed-legacy-'));
    const legacyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-unmanaged-legacy-'));
    fs.writeFileSync(path.join(legacyDir, 'chat-history.json'), '[{"text":"old","type":"user"}]', 'utf8');

    const paths = dataRoot.buildDataPaths({ app: { dataDir } });
    const target = dataRoot.legacyQuarantinePath(paths, 'legacy-chat-state');
    const result = dataRoot.moveDirectoryIntoManagedData(legacyDir, target);

    assert.equal(result.moved, true);
    assert.equal(fs.existsSync(legacyDir), false);
    assert.equal(fs.existsSync(path.join(result.targetPath, 'chat-history.json')), true);
    assert.ok(path.resolve(result.targetPath).startsWith(`${path.resolve(dataDir)}${path.sep}`));
  });

  it('should merge accidental root JSON arrays into managed data and remove the source', function() {
    const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-source-json-'));
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-target-json-'));
    const sourcePath = path.join(sourceDir, 'schedules.json');
    const targetPath = path.join(targetDir, 'schedules.json');
    dataRoot.writeJsonAtomic(targetPath, [{ id: 'existing' }], { backup: false });
    fs.writeFileSync(sourcePath, JSON.stringify([{ id: 'legacy' }, { id: '' }]), 'utf8');

    const result = dataRoot.migrateJsonArrayFile(sourcePath, targetPath, {
      limit: 5,
      normalizeItem: item => item?.id ? item : null
    });

    assert.equal(result.migrated.length, 1);
    assert.equal(fs.existsSync(sourcePath), false);
    assert.deepEqual(dataRoot.readSecureJsonFile(targetPath, [], {
      createIfMissing: false,
      validate: value => Array.isArray(value)
    }), [
      { id: 'existing' },
      { id: 'legacy' }
    ]);
    assert.match(fs.readFileSync(targetPath, 'utf8'), /OPENX_SECURE_JSON_V1/);
  });

  it('should recover JSON files from backup when the primary file is corrupt', function() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-json-recover-'));
    const filePath = path.join(tempDir, 'settings.json');

    dataRoot.writeJsonAtomic(filePath, { assistant: { displayName: 'Stable' } });
    dataRoot.writeJsonAtomic(filePath, { assistant: { displayName: 'Current' } });
    fs.writeFileSync(filePath, '{bad json', 'utf8');

    const recovered = dataRoot.readJsonFile(filePath, {});

    assert.equal(recovered.assistant.displayName, 'Stable');
    assert.equal(JSON.parse(fs.readFileSync(filePath, 'utf8')).assistant.displayName, 'Stable');
    assert.ok(fs.readdirSync(tempDir).some(name => /^settings\.json\.corrupt-/.test(name)));
  });

  it('should quarantine corrupt JSON and recreate a fallback when no backup can be used', function() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-json-fallback-'));
    const filePath = path.join(tempDir, 'state.json');

    fs.writeFileSync(filePath, '{bad json', 'utf8');
    const recovered = dataRoot.readJsonFile(filePath, { items: [] });

    assert.deepEqual(recovered, { items: [] });
    assert.deepEqual(JSON.parse(fs.readFileSync(filePath, 'utf8')), { items: [] });
    assert.ok(fs.readdirSync(tempDir).some(name => /^state\.json\.corrupt-/.test(name)));
  });
});
