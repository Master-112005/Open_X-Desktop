const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { Conversations, Messages, ChatManager } = require('../../core/chat');

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(32).toString('hex')}`;
}

async function createManager(options = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'openx-chat-conversations-'));
  const manager = new Conversations.ConversationManager({
    config: {
      storagePath: path.join(directory, 'conversations.json'),
      defaultPageSize: 3,
      maxPageSize: 20,
      maxPinnedChats: 2,
      ...(options.config || {})
    }
  });
  await manager.initialize();
  return {
    manager,
    directory,
    async cleanup() {
      await fs.rm(directory, { recursive: true, force: true });
    }
  };
}

describe('OpenX Chat Desktop Conversations Phase 13', () => {
  it('creates conversations, updates unread and last-message state, and searches locally', async () => {
    const harness = await createManager();
    try {
      const conversation = await harness.manager.createConversation({
        relationshipId: id('rel'),
        metadata: { title: 'Mummy' }
      });
      const updated = await harness.manager.addMessage({
        conversationId: conversation.conversationId,
        relationshipId: conversation.relationshipId,
        messageId: id('msg'),
        text: 'Dinner plan tomorrow',
        status: 'delivered',
        timestamp: '2026-07-18T10:00:00.000Z'
      });
      const search = await harness.manager.search({ query: 'dinn' });
      const history = await harness.manager.storage.listHistory(conversation.conversationId);

      assert.equal(updated.unreadCount, 1);
      assert.match(updated.lastMessageId, /^msg_/);
      assert.equal(history[0].status, 'delivered');
      assert.equal(search.items.length, 1);
      assert.equal(search.items[0].conversation.conversationId, conversation.conversationId);
      assert.equal(JSON.stringify(harness.manager.storage.state.ConversationAudit).includes('Dinner plan'), false);
    } finally {
      await harness.cleanup();
    }
  });

  it('supports pin, archive, mute, delete, restore, and clear history locally', async () => {
    const harness = await createManager();
    try {
      const first = await harness.manager.createConversation({ relationshipId: id('rel'), metadata: { title: 'Dad' } });
      await harness.manager.addMessage({ conversationId: first.conversationId, relationshipId: first.relationshipId, messageId: id('msg'), text: 'receipt file' });

      const pinned = await harness.manager.pin(first.conversationId);
      const muted = await harness.manager.mute(first.conversationId, { durationMs: 60000 });
      const archived = await harness.manager.archive(first.conversationId);
      const defaultList = await harness.manager.list();
      const archiveList = await harness.manager.list({ onlyArchived: true, includeArchived: true });
      const deleted = await harness.manager.deleteConversation(first.conversationId);
      const deletedDefault = await harness.manager.list({ includeArchived: true });
      const deletedVisible = await harness.manager.list({ includeDeleted: true, includeArchived: true });
      const restored = await harness.manager.restoreConversation(first.conversationId);
      const cleared = await harness.manager.clearHistory(first.conversationId);
      const unmuted = await harness.manager.unmute(first.conversationId);
      const unpinned = await harness.manager.unpin(first.conversationId);

      assert.equal(pinned.pinned, true);
      assert.equal(muted.muted, true);
      assert.equal(archived.archived, true);
      assert.equal(defaultList.items.length, 0);
      assert.equal(archiveList.items.length, 1);
      assert.equal(deleted.deleted, true);
      assert.equal(deletedDefault.items.length, 0);
      assert.equal(deletedVisible.items.length, 1);
      assert.equal(restored.deleted, false);
      assert.equal(cleared.lastMessageId, null);
      assert.equal(cleared.unreadCount, 0);
      assert.equal((await harness.manager.search({ query: 'receipt', includeArchived: true })).items.length, 0);
      assert.equal(unmuted.muted, false);
      assert.equal(unpinned.pinned, false);
    } finally {
      await harness.cleanup();
    }
  });

  it('updates local conversation person metadata and keeps search indexes current', async () => {
    const harness = await createManager();
    try {
      const conversation = await harness.manager.createConversation({
        relationshipId: id('rel'),
        metadata: { title: 'Old Name', peerHandle: 'old@openx' }
      });
      const updated = await harness.manager.updateConversationMetadata(conversation.conversationId, {
        title: 'Daddy',
        name: 'Daddy',
        peerHandle: 'dad@openx',
        status: 'dad@openx'
      });
      const search = await harness.manager.search({ query: 'dad@openx' });

      assert.equal(updated.metadata.title, 'Daddy');
      assert.equal(updated.metadata.peerHandle, 'dad@openx');
      assert.equal(search.items.length, 1);
      assert.equal(search.items[0].conversation.conversationId, conversation.conversationId);
    } finally {
      await harness.cleanup();
    }
  });

  it('caps local conversation history per chat and removes stale message search records', async () => {
    const harness = await createManager({ config: { maxHistoryPerConversation: 3 } });
    try {
      const conversation = await harness.manager.createConversation({
        relationshipId: id('rel'),
        metadata: { title: 'Rishi' }
      });
      for (let index = 0; index < 5; index += 1) {
        await harness.manager.addMessage({
          conversationId: conversation.conversationId,
          relationshipId: conversation.relationshipId,
          messageId: id('msg'),
          text: `retention-keyword-${index}`,
          timestamp: new Date(Date.UTC(2026, 6, 20, 10, index)).toISOString()
        });
      }

      const history = await harness.manager.storage.listHistory(conversation.conversationId);
      const oldSearch = await harness.manager.search({ query: 'retention-keyword-0', includeMessages: true });
      const keptSearch = await harness.manager.search({ query: 'retention-keyword-4', includeMessages: true });

      assert.equal(history.length, 3);
      assert.equal(history[0].searchText, 'retention-keyword-2');
      assert.equal(oldSearch.items.length, 0);
      assert.equal(keptSearch.items.length, 1);
    } finally {
      await harness.cleanup();
    }
  });

  it('caps local encrypted message storage and related state rows', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'openx-chat-message-retention-'));
    try {
      const config = new Messages.MessageConfiguration({
        storagePath: path.join(directory, 'messages.json'),
        maxStoredMessages: 3
      });
      const storage = new Messages.MessageStorage({ config });
      await storage.initialize();

      for (let index = 0; index < 5; index += 1) {
        await storage.upsertMessage({
          messageId: `msg_${String(index).padStart(64, 'a')}`.slice(0, 68),
          ciphertext: `cipher-${index}`,
          status: 'sent',
          timestamp: new Date(Date.UTC(2026, 6, 20, 11, index)).toISOString()
        });
      }

      assert.equal(storage.state.messages.length, 3);
      assert.deepEqual(storage.state.messages.map(message => message.ciphertext), ['cipher-2', 'cipher-3', 'cipher-4']);
      assert.equal(storage.state.messageStatus.length, 3);
      assert.equal(storage.state.messageStatus.every(status => storage.state.messages.some(message => message.messageId === status.messageId)), true);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });

  it('normalizes desktop message client transport failures', async () => {
    const config = new Messages.MessageConfiguration({
      apiBaseUrl: 'http://127.0.0.1:8090',
      requestTimeoutMs: 1000
    });
    let sawAbortSignal = false;
    const client = new Messages.MessageClient({
      config,
      fetchImpl: async (_url, request) => {
        sawAbortSignal = Boolean(request.signal);
        return {
          ok: true,
          status: 200,
          async text() {
            return 'not-json';
          }
        };
      }
    });

    await assert.rejects(
      () => client.send({ messageId: id('msg') }),
      error => error.code === 'message.response_invalid'
    );
    assert.equal(sawAbortSignal, true);

    const offlineClient = new Messages.MessageClient({
      config,
      fetchImpl: async () => {
        throw new Error('fetch failed');
      }
    });
    await assert.rejects(
      () => offlineClient.send({ messageId: id('msg') }),
      error => error.code === 'message.server_unreachable'
    );
  });

  it('uses shared Phase 8 envelopes for desktop chat sends without pinning one recipient device', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'openx-chat-shared-message-'));
    try {
      const relationshipId = id('rel');
      const senderAccountId = id('acc');
      const senderDeviceId = id('dev');
      const recipientAccountId = id('acc');
      const recipientDeviceId = id('dev');
      const sessionKey = crypto.createHash('sha256').update('shared-phase-8-session').digest();
      let routedMessage = null;
      const manager = new Messages.MessageManager({
        config: {
          apiBaseUrl: 'https://openx-chat-server.test',
          storagePath: path.join(directory, 'messages.json')
        },
        sessionResolver: () => sessionKey,
        connectionManager: {
          sendMessageEvent() {
            throw new Error('message sends must use the HTTP route so server acceptance is authoritative');
          }
        },
        client: {
          async send(message) {
            routedMessage = message;
            return { deliveredCount: 1, queuedCount: 0 };
          }
        }
      });

      const sent = await manager.sendText({
        relationshipId,
        senderAccountId,
        senderDeviceId,
        recipientAccountId,
        recipientDeviceId: null,
        plaintext: 'hi from desktop'
      });

      assert.equal(sent.delivery.queued, false);
      assert.equal(routedMessage.recipientDeviceId, null);
      const received = await manager.receiveEnvelope({
        envelope: {
          envelopeId: id('env'),
          messageId: routedMessage.messageId,
          senderDeviceId,
          recipientDeviceId,
          ciphertext: routedMessage.ciphertext,
          checksum: routedMessage.checksum,
          protocolVersion: routedMessage.version,
          createdAt: routedMessage.timestamp,
          mailboxSequence: 1,
          metadata: {
            relationshipId,
            senderAccountId,
            recipientAccountId,
            messageType: 'Text',
            timestamp: routedMessage.timestamp,
            compressionAlgorithm: routedMessage.compression.algorithm,
            compressionEnabled: routedMessage.compression.compressed,
            compressionVersion: routedMessage.compression.version,
            encryptionVersion: routedMessage.encryptionVersion
          }
        }
      });

      assert.equal(received.plaintext, 'hi from desktop');
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });

  it('stores server-accepted recipient mailbox handoff as sent, not local queued', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'openx-chat-server-accepted-'));
    try {
      const sessionKey = crypto.createHash('sha256').update('server-accepted-session').digest();
      const manager = new Messages.MessageManager({
        config: {
          apiBaseUrl: 'https://openx-chat-server.test',
          storagePath: path.join(directory, 'messages.json')
        },
        sessionResolver: () => sessionKey,
        connectionManager: {
          sendMessageEvent() {
            throw new Error('message sends must not be marked sent from an unacknowledged socket write');
          }
        },
        client: {
          async send() {
            return { deliveredCount: 0, queuedCount: 1 };
          }
        }
      });

      const sent = await manager.sendText({
        relationshipId: id('rel'),
        senderAccountId: id('acc'),
        senderDeviceId: id('dev'),
        recipientAccountId: id('acc'),
        recipientDeviceId: null,
        plaintext: 'server accepted this'
      });
      const status = manager.storage.state.messageStatus.find(item => item.messageId === sent.message.messageId);

      assert.equal(sent.delivery.queued, false);
      assert.equal(sent.delivery.serverQueued, true);
      assert.equal(status.status, Messages.MessageConstants.MESSAGE_STATUS.SENT);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });

  it('serializes old server-mailbox handoff records as sent instead of queued', async function() {
    const main = await fs.readFile(path.join(__dirname, '..', '..', 'apps', 'desktop', 'electron', 'main.js'), 'utf8');
    assert.match(main, /direction === 'outgoing' && isPlainObject\(entry\.delivery\)[\s\S]*\? summarizeDesktopChatDelivery\(entry\.delivery\)/);
    assert.match(main, /const DESKTOP_CHAT_SYNC_OVERLAP = 50;/);
    assert.match(main, /const afterSequence = Math\.max\(0, Number\(cursor\.lastAck \|\| 0\) - DESKTOP_CHAT_SYNC_OVERLAP\);/);
  });

  it('orders pinned and recent conversations, enforces pin limit, and paginates large lists', async () => {
    const harness = await createManager();
    try {
      const conversations = [];
      for (let index = 0; index < 8; index += 1) {
        const conversation = await harness.manager.createConversation({ relationshipId: id('rel'), metadata: { title: `Chat ${index}` } });
        await harness.manager.addMessage({
          conversationId: conversation.conversationId,
          relationshipId: conversation.relationshipId,
          messageId: id('msg'),
          text: `keyword-${index}`,
          timestamp: new Date(Date.UTC(2026, 6, 18, 10, index)).toISOString()
        });
        conversations.push(conversation);
      }
      await harness.manager.pin(conversations[2].conversationId);
      await harness.manager.pin(conversations[5].conversationId);
      await assert.rejects(() => harness.manager.pin(conversations[6].conversationId), /Pinned chat limit/);

      const firstPage = await harness.manager.list({ limit: 3 });
      const secondPage = await harness.manager.list({ limit: 3, cursor: firstPage.nextCursor });
      const unread = await harness.manager.list({ sortBy: 'unread', limit: 8 });
      await harness.manager.markRead(conversations[5].conversationId);
      await harness.manager.markUnread(conversations[5].conversationId, 4);
      const search = await harness.manager.search({ query: 'keyword-7', limit: 2 });

      assert.equal(firstPage.items.length, 3);
      assert.equal(firstPage.items[0].pinned, true);
      assert.equal(secondPage.items.length, 3);
      assert.equal(unread.items.every(item => item.unreadCount > 0), true);
      assert.equal((await harness.manager.getConversation(conversations[5].conversationId)).unreadCount, 4);
      assert.equal(search.items.length, 1);
      assert.equal(search.items[0].conversation.relationshipId, conversations[7].relationshipId);
    } finally {
      await harness.cleanup();
    }
  });

  it('is exposed from the top-level ChatManager without server dependencies', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'openx-chat-manager-conversations-'));
    try {
      const chat = new ChatManager({
        conversationConfig: { storagePath: path.join(directory, 'conversations.json') },
        fetchImpl: async () => {
          throw new Error('Conversation manager must not call the server.');
        },
        cryptoConfig: { storageBackend: {} }
      });
      const manager = chat.getConversationManager();
      const conversation = await manager.createConversation({ relationshipId: id('rel'), metadata: { title: 'Local only' } });

      assert.equal(chat.config.featureFlags.conversations, true);
      assert.match(conversation.conversationId, /^conv_/);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  });
});
