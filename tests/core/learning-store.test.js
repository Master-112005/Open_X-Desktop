const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('Learning Store (Personal Learning Model - Milestone 1)', function() {
  let cleanups = [];

  function makeRoot() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'learning-test-'));
    cleanups.push(root);
    return { root, keyPath: path.join(root, 'test.key') };
  }

  function makeStore() {
    const { root, keyPath } = makeRoot();
    const LearningStore = require('../../core/assistant/knowledge/LearningStore');
    return new LearningStore({ learning: { root, keyPath } });
  }

  after(function() {
    cleanups.forEach(dir => {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
    });
  });

  describe('fact schema', function() {
    it('should force high sensitivity for identity and relationship domains', function() {
      const { factModel } = require('../../core/assistant/knowledge');
      const identity = factModel.createFact({ domain: 'identity', predicate: 'has_name', object: 'Rakesh' });
      assert.strictEqual(identity.sensitivity, 'high');
      assert.strictEqual(identity.user_confirmed, false);
      assert.strictEqual(identity.subject, 'user');
      const thirdParty = factModel.createFact({ domain: 'relationship', subject: 'mom', predicate: 'is', object: 'Anita', source: 'explicit_statement' });
      assert.strictEqual(thirdParty.sensitivity, 'high');
      assert.strictEqual(thirdParty.subject, 'mom');
    });

    it('should default routine facts to medium sensitivity', function() {
      const { factModel } = require('../../core/assistant/knowledge');
      const routine = factModel.createFact({ domain: 'routine', predicate: 'wakes_at', object: '07:00' });
      assert.strictEqual(routine.sensitivity, 'medium');
    });

    it('should refuse facts below the confidence floor', function() {
      const { factModel } = require('../../core/assistant/knowledge');
      assert.throws(() => factModel.createFact({
        domain: 'preference', predicate: 'prefers', object: 'chrome', confidence: 0.1
      }), RangeError);
    });

    it('should require a predicate and an object', function() {
      const { factModel } = require('../../core/assistant/knowledge');
      assert.throws(() => factModel.createFact({ domain: 'preference', object: 'chrome' }));
      assert.throws(() => factModel.createFact({ domain: 'preference', predicate: 'prefers' }));
      assert.throws(() => factModel.createFact({ domain: 'unknown-domain', predicate: 'x', object: 'y' }));
    });
  });

  describe('store initialization and encryption', function() {
    it('should create encrypted + schema + audit files under the learning folder', function() {
      const store = makeStore();
      store.initialize();
      assert.strictEqual(fs.existsSync(store.factsDbPath), true);
      assert.strictEqual(fs.existsSync(store.schemaPath), true);
      assert.strictEqual(fs.existsSync(store.auditPath), true);
      assert.strictEqual(fs.existsSync(store.pendingPath), true);
      const marker = JSON.parse(fs.readFileSync(store.schemaPath, 'utf8'));
      assert.strictEqual(marker.schemaVersion, 1);
      assert.strictEqual(marker.format, 'OPENX_LEARNING_FACTS_V1');
    });

    it('should store facts in an encrypted envelope without leaking plaintext', function() {
      const store = makeStore();
      store.initialize();
      const added = store.addFact({ domain: 'relationship', predicate: 'has_sibling', object: 'Priya' }, { confirmed: true });
      assert.strictEqual(added.success, true);
      const raw = fs.readFileSync(store.factsDbPath, 'utf8');
      assert.strictEqual(raw.includes('Priya'), false);
      assert.strictEqual(raw.includes('OPENX_SECURE_JSON_V1'), true);
    });

    it('should refuse a newer schema version than it understands', function() {
      const store = makeStore();
      store.initialize();
      fs.writeFileSync(store.schemaPath, JSON.stringify({ schemaVersion: 99, format: 'FUTURE' }));
      assert.throws(() => store.initialize(), /Unsupported learning schema version: 99/);
    });
  });

  describe('confirmation gating', function() {
    it('should block high-sensitivity facts until confirmed and not persist them', function() {
      const store = makeStore();
      store.initialize();
      const result = store.addFact({ domain: 'identity', predicate: 'has_name', object: 'Rakesh' });
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.requiresConfirmation, true);
      assert.strictEqual(store.stats().factCount, 0);
      const confirmed = store.addFact({ domain: 'identity', predicate: 'has_name', object: 'Rakesh' }, { confirmed: true });
      assert.strictEqual(confirmed.success, true);
      assert.strictEqual(confirmed.fact.user_confirmed, true);
      assert.strictEqual(store.stats().factCount, 1);
    });

    it('should require confirmation before wiping everything', function() {
      const store = makeStore();
      store.initialize();
      store.addFact({ domain: 'preference', predicate: 'prefers', object: 'chrome' });
      const blocked = store.wipeAll();
      assert.strictEqual(blocked.requiresConfirmation, true);
      assert.strictEqual(store.stats().factCount, 1);
      const done = store.wipeAll({ confirmed: true });
      assert.strictEqual(done.success, true);
      assert.strictEqual(store.stats().factCount, 0);
    });
  });

  describe('persistence round trip', function() {
    it('should reload facts and keep id allocation consistent', function() {
      const { root, keyPath } = makeRoot();
      const LearningStore = require('../../core/assistant/knowledge/LearningStore');
      const first = new LearningStore({ learning: { root, keyPath } });
      first.initialize();
      first.addFact({ domain: 'identity', predicate: 'has_name', object: 'Rakesh' }, { confirmed: true });
      first.addFact({ domain: 'preference', predicate: 'prefers', object: 'chrome' }, {});
      assert.strictEqual(first.stats().factCount, 2);

      const second = new LearningStore({ learning: { root, keyPath } });
      second.initialize();
      const facts = second.listFacts();
      assert.strictEqual(facts.length, 2);
      assert.deepStrictEqual(facts.find(f => f.predicate === 'has_name').object, 'Rakesh');
      const next = second.addFact({ domain: 'preference', predicate: 'volume_default', object: '40' });
      assert.notStrictEqual(next.fact.id, first.listFacts()[0].id);
      assert.strictEqual(second.getFact(facts[0].id).id, facts[0].id);
    });
  });

  describe('reinforcement and decay', function() {
    it('should reinforce confidence on a diminishing curve and cap it', function() {
      const store = makeStore();
      store.initialize();
      const added = store.addFact({ domain: 'routine', predicate: 'wakes_at', object: '07:00', confidence: 0.5 });
      let confidence = added.fact.confidence;
      assert.strictEqual(confidence, 0.5);
      for (let i = 0; i < 50; i += 1) {
        const reinforced = store.reinforceFact(added.fact.id);
        assert.ok(reinforced.fact.confidence > confidence || reinforced.fact.confidence === 0.99);
        confidence = reinforced.fact.confidence;
      }
      assert.strictEqual(confidence, 0.99);
      const evidence = store.getFact(added.fact.id).evidence_count;
      assert.strictEqual(evidence, 50);
    });

    it('should decay routine facts over time but leave identity facts stable', function() {
      const store = makeStore();
      store.initialize();
      const routine = store.addFact({ domain: 'routine', predicate: 'wakes_at', object: '07:00', confidence: 0.5 });
      const identity = store.addFact({ domain: 'identity', predicate: 'has_name', object: 'Rakesh' }, { confirmed: true });
      const week = 7 * 24 * 60 * 60 * 1000;
      const later = new Date(Date.now() + 2 * week).toISOString();
      const decay = store.runDecay({ at: later });
      assert.strictEqual(decay.updated >= 1, true);
      const routineAfter = store.getFact(routine.fact.id).confidence;
      const identityAfter = store.getFact(identity.fact.id).confidence;
      assert.ok(routineAfter < 0.5, `routine should decay (got ${routineAfter})`);
      assert.strictEqual(identityAfter, identity.fact.confidence);
    });

    it('should expire context facts that decay below the floor', function() {
      const store = makeStore();
      store.initialize();
      const context = store.addFact({ domain: 'context', predicate: 'current_project', object: 'OpenX sync', confidence: 0.5 });
      const week = 7 * 24 * 60 * 60 * 1000;
      const later = new Date(Date.now() + 10 * week).toISOString();
      const decay = store.runDecay({ at: later });
      assert.strictEqual(decay.expired >= 1, true);
      assert.strictEqual(store.getFact(context.fact.id), null);
      const expired = store.audit.readByAction('expired');
      assert.strictEqual(expired.length >= 1, true);
    });
  });

  describe('contradiction and versioned history', function() {
    it('should version a low-sensitivity update without confirmation', function() {
      const store = makeStore();
      store.initialize();
      const added = store.addFact({ domain: 'preference', predicate: 'prefers', object: 'edge' });
      const updated = store.updateFact(added.fact.id, { object: 'chrome', reason: 'user_correction' });
      assert.strictEqual(updated.success, true);
      assert.strictEqual(updated.fact.object, 'chrome');
      assert.strictEqual(updated.fact.history.length, 1);
      assert.strictEqual(updated.fact.history[0].object, 'edge');
      assert.strictEqual(updated.fact.history[0].reason, 'user_correction');
    });

    it('should block high-sensitivity contradiction until confirmed and preserve the old value', function() {
      const store = makeStore();
      store.initialize();
      const added = store.addFact({ domain: 'relationship', predicate: 'has_sibling', object: 'Priya' }, { confirmed: true });
      const blocked = store.updateFact(added.fact.id, { object: 'Priyanka' });
      assert.strictEqual(blocked.requiresConfirmation, true);
      assert.strictEqual(store.getFact(added.fact.id).object, 'Priya');
      assert.strictEqual(store.getFact(added.fact.id).history.length, 0);

      const confirmed = store.updateFact(added.fact.id, { object: 'Priyanka', reason: 'correction' }, { confirmed: true });
      assert.strictEqual(confirmed.success, true);
      assert.strictEqual(confirmed.fact.object, 'Priyanka');
      assert.strictEqual(confirmed.fact.history.length, 1);
      assert.strictEqual(confirmed.fact.history[0].object, 'Priya');
    });

    it('should not update when the value is already current', function() {
      const store = makeStore();
      store.initialize();
      const added = store.addFact({ domain: 'preference', predicate: 'prefers', object: 'chrome' });
      const same = store.updateFact(added.fact.id, { object: 'chrome' });
      assert.strictEqual(same.alreadyCurrent, true);
      assert.strictEqual(store.getFact(added.fact.id).history.length, 0);
    });
  });

  describe('deletion and wipes', function() {
    it('should hard-delete a fact and keep only a metadata-only audit record', function() {
      const store = makeStore();
      store.initialize();
      const added = store.addFact({ domain: 'relationship', predicate: 'has_sibling', object: 'Sri Deepthi' }, { confirmed: true });
      const removed = store.deleteFact(added.fact.id);
      assert.strictEqual(removed.success, true);
      assert.strictEqual(store.getFact(added.fact.id), null);
      assert.strictEqual(store.stats().factCount, 0);
      const audit = store.audit.read();
      const deleteEntry = audit.find(entry => entry.action === 'delete');
      assert.ok(deleteEntry, 'expected a delete audit entry');
      const serialized = JSON.stringify(audit);
      assert.strictEqual(serialized.includes('Sri Deepthi'), false);
    });

    it('should wipe a single domain and leave others intact', function() {
      const store = makeStore();
      store.initialize();
      store.addFact({ domain: 'identity', predicate: 'has_name', object: 'Rakesh' }, { confirmed: true });
      store.addFact({ domain: 'relationship', predicate: 'has_sibling', object: 'Priya' }, { confirmed: true });
      store.addFact({ domain: 'preference', predicate: 'prefers', object: 'chrome' });
      const wiped = store.wipeDomain('relationship');
      assert.strictEqual(wiped.removed, 1);
      assert.strictEqual(store.stats().factCount, 2);
      assert.strictEqual(store.listFacts({ domain: 'relationship' }).length, 0);
      assert.strictEqual(store.getFact(wiped === undefined ? '' : store.findFacts('user', 'has_name')[0].id) && true, true);
      assert.ok(store.findFacts('user', 'prefers').length > 0);
    });
  });

  describe('pending review flow', function() {
    it('should keep inferred facts in pending until promoted or rejected', function() {
      const store = makeStore();
      store.initialize();
      const inferred = store.addInferredFact({ domain: 'preference', predicate: 'prefers', object: 'chrome', confidence: 0.4 });
      assert.strictEqual(inferred.success, true);
      assert.strictEqual(store.listPending().length, 1);
      assert.strictEqual(store.stats().factCount, 0);
      assert.strictEqual(inferred.fact.source, 'inferred');

      const promoted = store.promotePendingFact(inferred.fact.id);
      assert.strictEqual(promoted.success, true);
      assert.strictEqual(promoted.fact.user_confirmed, true);
      assert.ok(promoted.fact.confidence >= 0.6);
      assert.strictEqual(store.listPending().length, 0);
      assert.strictEqual(store.stats().factCount, 1);
    });

    it('should require confirmation before promoting medium/high pending facts', function() {
      const store = makeStore();
      store.initialize();
      const inferred = store.addInferredFact({ domain: 'routine', predicate: 'wakes_at', object: '07:30', confidence: 0.45 });
      const blocked = store.promotePendingFact(inferred.fact.id);
      assert.strictEqual(blocked.requiresConfirmation, true);
      assert.strictEqual(store.listPending().length, 1);
      const promoted = store.promotePendingFact(inferred.fact.id, { confirmed: true });
      assert.strictEqual(promoted.success, true);
      assert.strictEqual(store.listPending().length, 0);
    });

    it('should reject pending facts including medium-high ones', function() {
      const store = makeStore();
      store.initialize();
      const inferred = store.addInferredFact({ domain: 'identity', predicate: 'born_in', object: 'Tenali', confidence: 0.5 });
      const rejected = store.rejectPendingFact(inferred.fact.id);
      assert.strictEqual(rejected.success, true);
      assert.strictEqual(store.listPending().length, 0);
      assert.strictEqual(store.stats().factCount, 0);
    });

    it('should refuse inferred facts above the starting confidence', function() {
      const store = makeStore();
      store.initialize();
      const result = store.addInferredFact({ domain: 'routine', predicate: 'wakes_at', object: '07:30', confidence: 0.8 });
      assert.strictEqual(result.success, false);
    });
  });

  describe('third-party model guard', function() {
    it('should allow reference facts about family but reject modeling domains for others', function() {
      const store = makeStore();
      store.initialize();
      const reference = store.addFact({ domain: 'relationship', subject: 'mom', predicate: 'is_named', object: 'Anita' }, { confirmed: true });
      assert.strictEqual(reference.success, true);
      const denied = store.addFact({ domain: 'routine', subject: 'son', predicate: 'wakes_at', object: '07:00' });
      assert.strictEqual(denied.success, false);
      assert.match(denied.error, /primary user/);
      const deniedPending = store.addInferredFact({ domain: 'preference', subject: 'friend', predicate: 'prefers', object: 'chrome' });
      assert.strictEqual(deniedPending.success, false);
    });
  });

  describe('retrieval and audit shape', function() {
    it('should expose only confirmed user facts as a plain map', function() {
      const store = makeStore();
      store.initialize();
      store.addFact({ domain: 'identity', predicate: 'has_name', object: 'Rakesh' }, { confirmed: true });
      store.addFact({ domain: 'preference', predicate: 'prefers', object: 'edge' });
      const facts = store.getAllUserFacts();
      assert.deepStrictEqual(facts, { 'user:has_name': 'Rakesh' });
    });

    it('should write only metadata keys to the audit log', function() {
      const store = makeStore();
      store.initialize();
      store.addFact({ domain: 'identity', predicate: 'has_name', object: 'Rakesh' }, { confirmed: true });
      store.addFact({ domain: 'preference', predicate: 'prefers', object: 'chrome' });
      const allowed = new Set(['ts', 'action', 'domain', 'factId', 'sensitivity']);
      const entries = store.audit.read();
      assert.ok(entries.length >= 2);
      entries.forEach(entry => {
        Object.keys(entry).forEach(key => assert.ok(allowed.has(key), `unexpected audit key ${key}`));
      });
      const serialized = JSON.stringify(entries);
      assert.strictEqual(serialized.includes('Rakesh'), false);
      assert.strictEqual(serialized.includes('chrome'), false);
    });

    it('should report store stats', function() {
      const store = makeStore();
      store.initialize();
      store.addFact({ domain: 'identity', predicate: 'has_name', object: 'Rakesh' }, { confirmed: true });
      store.addFact({ domain: 'preference', predicate: 'prefers', object: 'chrome' });
      const stats = store.stats();
      assert.strictEqual(stats.factCount, 2);
      assert.strictEqual(stats.byDomain.identity, 1);
      assert.strictEqual(stats.byDomain.preference, 1);
      assert.strictEqual(stats.pendingCount, 0);
    });
  });
});