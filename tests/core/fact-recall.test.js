const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Fact Recall (Personal Learning Model - Milestone 3)', function() {
  let cleanups = [];

  function makeRoot() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'recall-test-'));
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

  function makeAssistant(store) {
    const Assistant = require('../../core/assistant/index');
    return new Assistant(
      { learning: { enabled: true } },
      {
        learningStore: store,
        router: {
          process: async () => ({ success: true, intent: 'unknown', response: 'router fallback', entities: {} })
        },
        automation: {},
        eventBus: { publish() {} }
      }
    );
  }

  after(function() {
    cleanups.forEach(dir => {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
    });
  });

  describe('unit recall with a fake store', function() {
    const FactRecall = require('../../core/assistant/knowledge/FactRecall');
    const facts = [
      { id: 'f1', domain: 'identity', subject: 'user', predicate: 'has_name', object: 'rakesh', user_confirmed: true },
      { id: 'f2', domain: 'identity', subject: 'user', predicate: 'has_location', object: 'tenali', user_confirmed: true },
      { id: 'f3', domain: 'identity', subject: 'user', predicate: 'date_of_birth', object: '15 june 1996', user_confirmed: true },
      { id: 'f4', domain: 'relationship', subject: 'mother', predicate: 'has_name', object: 'anita', user_confirmed: true }
    ];
    const store = {
      getAllUserFacts: () => ({
        'user:has_name': 'rakesh',
        'user:has_location': 'tenali',
        'user:date_of_birth': '15 june 1996'
      }),
      findFacts: (subject, predicate) => facts.filter(f =>
        (subject == null || f.subject === subject) && (predicate == null || f.predicate === predicate)),
      listFacts: () => facts
    };
    const recall = new FactRecall(store);

    it('should answer name, location, and birthday questions', function() {
      assert.strictEqual(recall.answer('what is my name?').data.value, 'rakesh');
      assert.strictEqual(recall.answer('whats my name').data.value, 'rakesh');
      assert.strictEqual(recall.answer('do you know my name').data.known, true);
      assert.strictEqual(recall.answer('where do i live').data.value, 'tenali');
      assert.strictEqual(recall.answer('when is my birthday').data.value, '15 june 1996');
    });

    it('should answer relationship questions with synonym normalization', function() {
      assert.strictEqual(recall.answer('who is my mother').data.value, 'anita');
      assert.strictEqual(recall.answer("what's my mom's name").data.value, 'anita');
      assert.strictEqual(recall.answer('do you remember my mother').data.known, true);
    });

    it('should summarize confirmed facts', function() {
      const result = recall.answer('what do you know about me?');
      assert.strictEqual(result.intent, 'learning.recall');
      assert.match(result.response, /your name is "rakesh"/);
      assert.match(result.response, /your hometown is "tenali"/);
      assert.match(result.response, /your mother is named "anita"/);
    });

    it('should ignore non-recall inputs', function() {
      assert.strictEqual(recall.answer('open chrome'), null);
      assert.strictEqual(recall.answer('my name is rakesh'), null);
      assert.strictEqual(recall.answer('play music'), null);
    });

    it('should answer gracefully when a fact is unknown', function() {
      const empty = new FactRecall({ getAllUserFacts: () => ({}), findFacts: () => [], listFacts: () => [] });
      const result = empty.answer('what is my name');
      assert.strictEqual(result.data.known, false);
      assert.match(result.response, /do not know your name/);
      assert.strictEqual(empty.answer('what do you know about me').data.count, 0);
    });
  });

  describe('assistant recall integration', function() {
    it('should recall the name after it was captured and confirmed', async function() {
      const store = makeStore();
      const assistant = makeAssistant(store);
      await assistant.processCommand('my name is rakesh');
      await assistant.processCommand('yes');

      const result = await assistant.processCommand('what is my name?');
      assert.strictEqual(result.intent, 'learning.recall');
      assert.match(result.response, /your name is "rakesh"/i);
    });

    it('should recall a location captured earlier', async function() {
      const store = makeStore();
      const assistant = makeAssistant(store);
      await assistant.processCommand('i live in tenali');
      await assistant.processCommand('yes');
      const result = await assistant.processCommand('where do i live?');
      assert.match(result.response, /tenali/);
    });

    it('should recall a relationship and answer the summary', async function() {
      const store = makeStore();
      const assistant = makeAssistant(store);
      await assistant.processCommand('my mother is anita');
      await assistant.processCommand('yes');
      const direct = await assistant.processCommand('who is my mother?');
      assert.match(direct.response, /your mother is named "anita"/i);
      const summary = await assistant.processCommand('what do you know about me?');
      assert.match(summary.response, /anita/i);
    });

    it('should answer unknown recall with guidance instead of routing', async function() {
      const store = makeStore();
      const assistant = makeAssistant(store);
      const result = await assistant.processCommand('what is my name?');
      assert.strictEqual(result.intent, 'learning.recall');
      assert.match(result.response, /do not know your name/);
    });

    it('should not recall when learning is disabled', async function() {
      const Assistant = require('../../core/assistant/index');
      const assistant = new Assistant({}, {
        router: {
          process: async () => ({ success: true, intent: 'unknown', response: 'router fallback', entities: {} })
        },
        automation: {},
        eventBus: { publish() {} }
      });
      const result = await assistant.processCommand('what is my name?');
      assert.match(result.response, /router fallback/);
    });
  });
});