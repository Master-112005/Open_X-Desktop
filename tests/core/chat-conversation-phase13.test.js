const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { Conversations, ChatManager } = require('../../core/chat');

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
        timestamp: '2026-07-18T10:00:00.000Z'
      });
      const search = await harness.manager.search({ query: 'dinn' });

      assert.equal(updated.unreadCount, 1);
      assert.match(updated.lastMessageId, /^msg_/);
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
