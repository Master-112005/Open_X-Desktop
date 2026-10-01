const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Statement Capture (Personal Learning Model - Milestone 2)', function() {
  let cleanups = [];

  function makeRoot() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-test-'));
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

  describe('extraction', function() {
    let capture;

    before(function() {
      const StatementCapture = require('../../core/assistant/knowledge/StatementCapture');
      capture = new StatementCapture();
    });

    it('should extract an explicit name statement', function() {
      const result = capture.extract('my name is rakesh');
      assert.strictEqual(result.length, 1);
      assert.deepStrictEqual(result[0].predicate, 'has_name');
      assert.deepStrictEqual(result[0].subject, 'user');
      assert.deepStrictEqual(result[0].object, 'rakesh');
      assert.deepStrictEqual(result[0].source, 'explicit_statement');
    });

    it('should accept alternates: called-me, i am, and leading small talk', function() {
      assert.strictEqual(capture.extract('i am called priya')[0].object, 'priya');
      assert.strictEqual(capture.extract('call me ram')[0].object, 'ram');
      assert.strictEqual(capture.extract('i am anmol')[0].object, 'anmol');
      assert.strictEqual(capture.extract('hello, my name is rakesh')[0].object, 'rakesh');
    });

    it('should extract relationship statements and normalize the relation', function() {
      const direct = capture.extract('my mother is anita');
      assert.strictEqual(direct[0].subject, 'mother');
      assert.strictEqual(direct[0].object, 'anita');
      const possessive = capture.extract('my sister\'s name is priya');
      assert.strictEqual(possessive[0].subject, 'sister');
      assert.strictEqual(possessive[0].object, 'priya');
      const haveA = capture.extract('i have a brother named ravi');
      assert.strictEqual(haveA[0].subject, 'brother');
      assert.strictEqual(haveA[0].object, 'ravi');
    });

    it('should accept location and birthday statements', function() {
      assert.strictEqual(capture.extract('i live in tenali')[0].predicate, 'has_location');
      assert.strictEqual(capture.extract('i am from hyderabad')[0].predicate, 'has_location');
      assert.strictEqual(capture.extract('my birthday is 15 june 1996')[0].predicate, 'date_of_birth');
      assert.strictEqual(capture.extract('i was born on 15 june 1996')[0].object, '15 june 1996');
    });

    it('should reject questions, commands, moods, negations, and third-party facts', function() {
      assert.strictEqual(capture.extract('what is my name').length, 0);
      assert.strictEqual(capture.extract('play music').length, 0);
      assert.strictEqual(capture.extract('my day is good').length, 0);
      assert.strictEqual(capture.extract('i am happy').length, 0);
      assert.strictEqual(capture.extract('i am busy').length, 0);
      assert.strictEqual(capture.extract('my name is not rakesh').length, 0);
      assert.strictEqual(capture.extract('his name is x').length, 0);
      assert.strictEqual(capture.extract('i like pizza').length, 0);
      assert.strictEqual(capture.extract('my name is 123').length, 0);
    });

    it('should only capture the short "i am X" form in small sentences', function() {
      assert.strictEqual(capture.extract('i am rakesh and i am tired')[0].object, 'rakesh');
      assert.strictEqual(capture.extract('i am from hyderabad')[0].predicate, 'has_location');
      assert.strictEqual(capture.extract('i am tired of waiting for you').length, 0);
    });

    it('should build confirmation questions', function() {
      const StatementCapture = require('../../core/assistant/knowledge/StatementCapture');
      assert.match(StatementCapture.buildQuestion({ domain: 'identity', subject: 'user', predicate: 'has_name', object: 'rakesh' }), /remember your name as "rakesh"/);
      assert.match(StatementCapture.buildQuestion({ domain: 'relationship', subject: 'mother', predicate: 'has_name', object: 'anita' }), /your mother is named "anita"/);
      assert.match(StatementCapture.buildQuestion({ domain: 'identity', subject: 'user', predicate: 'has_name', object: 'ross' }, 'rakesh'), /update it to "ross"/);
    });
  });

  describe('assistant confirmation flow', function() {
    it('should ask before storing an identity statement and store it on confirmation', async function() {
      const store = makeStore();
      const assistant = makeAssistant(store);
      const first = await assistant.processCommand('my name is rakesh');
      assert.strictEqual(first.requiresConfirmation, true);
      assert.strictEqual(first.intent, 'learning.capture');
      assert.match(first.response, /remember your name as "rakesh"/);
      assert.ok(assistant.pendingCaptureConfirmation, 'expected a pending capture confirmation');
      assert.strictEqual(store.stats().factCount, 0);

      const confirmed = await assistant.processCommand('yes');
      assert.strictEqual(confirmed.learned, true);
      assert.match(confirmed.response, /remember that your name is "rakesh"/);
      assert.strictEqual(store.stats().factCount, 1);
      assert.deepStrictEqual(store.getAllUserFacts(), { 'user:has_name': 'rakesh' });
      assert.strictEqual(assistant.pendingCaptureConfirmation, null);
    });

    it('should ask before storing a relationship statement and store on confirmation', async function() {
      const store = makeStore();
      const assistant = makeAssistant(store);
      const first = await assistant.processCommand('my mother is anita');
      assert.strictEqual(first.requiresConfirmation, true);
      assert.match(first.response, /your mother is named "anita"/);
      const confirmed = await assistant.processCommand('yes');
      assert.strictEqual(confirmed.learned, true);
      const facts = store.findFacts('mother', 'has_name');
      assert.strictEqual(facts.length, 1);
      assert.strictEqual(facts[0].object, 'anita');
      assert.strictEqual(facts[0].user_confirmed, true);
    });

    it('should acknowledge a repeated statement without creating a duplicate', async function() {
      const store = makeStore();
      const assistant = makeAssistant(store);
      await assistant.processCommand('my name is rakesh');
      await assistant.processCommand('yes');
      const repeat = await assistant.processCommand('my name is rakesh');
      assert.strictEqual(repeat.learned, false);
      assert.match(repeat.response, /already remember/);
      assert.strictEqual(store.listFacts({ confirmed: true }).length, 1);
    });

    it('should not store anything when the user cancels', async function() {
      const store = makeStore();
      const assistant = makeAssistant(store);
      await assistant.processCommand('i live in hyderabad');
      assert.ok(assistant.pendingCaptureConfirmation);
      const cancelled = await assistant.processCommand('no');
      assert.strictEqual(cancelled.learned, false);
      assert.match(cancelled.response, /will not remember/);
      assert.strictEqual(store.stats().factCount, 0);
      assert.strictEqual(assistant.pendingCaptureConfirmation, null);
    });

    it('should re-ask until a clear yes or no is given', async function() {
      const store = makeStore();
      const assistant = makeAssistant(store);
      await assistant.processCommand('my name is rakesh');
      const unclear = await assistant.processCommand('maybe later');
      assert.strictEqual(unclear.requiresConfirmation, true);
      assert.match(unclear.response, /say yes to remember it/);
      assert.strictEqual(store.stats().factCount, 0);
      const cancelled = await assistant.processCommand('no thanks');
      assert.strictEqual(cancelled.learned, false);
      assert.strictEqual(assistant.pendingCaptureConfirmation, null);
    });

    it('should version an explicit correction after confirmation', async function() {
      const store = makeStore();
      const assistant = makeAssistant(store);
      await assistant.processCommand('my name is rakesh');
      await assistant.processCommand('yes');
      const conflict = await assistant.processCommand('my name is ross');
      assert.strictEqual(conflict.requiresConfirmation, true);
      assert.match(conflict.response, /already have your name as "rakesh"/);
      assert.match(conflict.response, /update it to "ross"/);
      assert.ok(assistant.pendingCaptureConfirmation.existingId, 'expected existing fact id');

      const updated = await assistant.processCommand('yes');
      assert.strictEqual(updated.learned, true);
      const facts = store.findFacts('user', 'has_name');
      assert.strictEqual(facts[0].object, 'ross');
      assert.strictEqual(facts[0].history.length, 1);
      assert.strictEqual(facts[0].history[0].object, 'rakesh');
    });

    it('should capture only the first candidate of a compound statement', async function() {
      const store = makeStore();
      const assistant = makeAssistant(store);
      const result = await assistant.processCommand('my name is rakesh and my sister is priya');
      assert.match(result.response, /remember your name as "rakesh"/);
      assert.ok(assistant.pendingCaptureConfirmation);
      await assistant.processCommand('yes');
      assert.strictEqual(store.listFacts({ confirmed: true }).length, 1);
    });

    it('should not capture when learning is disabled', async function() {
      const Assistant = require('../../core/assistant/index');
      const assistant = new Assistant({}, {
        router: {
          process: async () => ({ success: true, intent: 'unknown', response: 'router fallback', entities: {} })
        },
        automation: {},
        eventBus: { publish() {} }
      });
      assert.strictEqual(assistant.learningStore, null);
      const result = await assistant.processCommand('my name is rakesh');
      assert.strictEqual(assistant.pendingCaptureConfirmation, null);
      assert.match(result.response, /router fallback/);
    });
  });
});