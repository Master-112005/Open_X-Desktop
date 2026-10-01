const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Profile Name Sync', function() {
  let cleanups = [];

  function makeRoot() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-sync-'));
    cleanups.push(root);
    return root;
  }

  function makeStore() {
    const root = makeRoot();
    const LearningStore = require('../../core/assistant/knowledge/LearningStore');
    const store = new LearningStore({ learning: { root, keyPath: path.join(root, 'k.key') } });
    store.initialize();
    return store;
  }

  function makeAssistant(store, config = {}, dependencies = {}) {
    const Assistant = require('../../core/assistant/index');
    return new Assistant(
      { learning: { enabled: true }, ...config },
      {
        learningStore: store,
        router: {
          process: async () => ({ success: true, intent: 'unknown', response: 'router fallback', entities: {} })
        },
        automation: {},
        eventBus: { publish() {} },
        ...dependencies
      }
    );
  }

  after(function() {
    cleanups.forEach(dir => {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
    });
  });

  describe('LearningStore user name', function() {
    it('should set, read and update the user name without duplicating facts', function() {
      const store = makeStore();
      assert.strictEqual(store.getUserName(), null);

      const first = store.setUserName('Rakesh');
      assert.strictEqual(first.success, true);
      assert.strictEqual(store.getUserName(), 'Rakesh');

      const unchanged = store.setUserName('Rakesh');
      assert.strictEqual(unchanged.success, true);
      assert.strictEqual(unchanged.unchanged, true);

      const updated = store.setUserName('Ross', { reason: 'settings_sync' });
      assert.strictEqual(updated.success, true);
      assert.strictEqual(store.getUserName(), 'Ross');
      assert.strictEqual(store.findFacts('user', 'has_name').length, 1);
      assert.strictEqual(store.getAllUserFacts()['user:has_name'], 'Ross');
    });

    it('should reject an empty name', function() {
      const store = makeStore();
      const result = store.setUserName('   ');
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'name_required');
    });
  });

  describe('Assistant profile wiring', function() {
    it('should seed the learning store from the settings profile name on startup', function() {
      const store = makeStore();
      const assistant = makeAssistant(store, { assistant: { userProfile: { fullName: 'Priya' } } });
      assert.strictEqual(store.getUserName(), 'Priya');
      assert.strictEqual(assistant.userName, 'Priya');
    });

    it('should notify the settings bridge when the user tells the assistant their name', async function() {
      const store = makeStore();
      const changes = [];
      const assistant = makeAssistant(store, {}, { onUserNameChanged: name => changes.push(name) });

      const first = await assistant.processCommand('call me priya');
      assert.strictEqual(first.requiresConfirmation, true);
      const confirmed = await assistant.processCommand('yes');
      assert.strictEqual(confirmed.learned, true);

      assert.deepStrictEqual(changes, ['priya']);
      assert.strictEqual(store.getUserName(), 'priya');
      assert.strictEqual(assistant.config.userProfile.fullName, 'priya');
    });

    it('should apply a settings-supplied name without firing the notify bridge', function() {
      const store = makeStore();
      const changes = [];
      const assistant = makeAssistant(store, {}, { onUserNameChanged: name => changes.push(name) });

      const result = assistant.applyUserProfileName('Anita', { reason: 'settings_sync' });
      assert.strictEqual(result.success, true);
      assert.strictEqual(store.getUserName(), 'Anita');
      assert.strictEqual(assistant.userName, 'Anita');
      assert.deepStrictEqual(changes, []);
    });
  });
});
