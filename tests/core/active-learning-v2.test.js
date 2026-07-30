'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ActiveLearningManager = require('../../core/assistant/learning/ActiveLearningManager');
const { readSecureJsonFile } = require('../../core/assistant/Data');

describe('Active Learning v2', function() {
  function createManager() {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-learning-v2-'));
    return {
      dataDir,
      manager: new ActiveLearningManager({
        app: { dataDir },
        activeLearning: { enabled: true }
      })
    };
  }

  it('stores only the five JSON stores under the managed learning directory', function() {
    const { dataDir, manager } = createManager();
    const learningDir = path.join(dataDir, 'learning');

    assert.equal(manager.getLearningPath(), learningDir);
    assert.deepEqual(fs.readdirSync(learningDir).sort(), [
      'aliases.json',
      'corrections.json',
      'preferences.json',
      'usage_stats.json',
      'workflows.json'
    ]);
    assert.ok(fs.existsSync(path.join(dataDir, 'security', 'openx-data.key')));
  });

  it('asks on the third alias occurrence but persists only after approval', function() {
    const { dataDir, manager } = createManager();

    assert.equal(manager.learnAlias('code', 'Code.exe').stage, 'ignored');
    assert.equal(manager.learnAlias('code', 'Code.exe').stage, 'observing');
    assert.equal(manager.learnAlias('code', 'Code.exe').stage, 'ready_to_learn');

    const beforeApprovalPath = path.join(dataDir, 'learning', 'aliases.json');
    const beforeApproval = readSecureJsonFile(beforeApprovalPath, {}, {
      createIfMissing: false,
      validate: value => value && value.version === 1
    });
    assert.deepEqual(beforeApproval.aliases, {});
    assert.match(fs.readFileSync(beforeApprovalPath, 'utf8'), /OPENX_SECURE_JSON_V1/);
    assert.doesNotMatch(fs.readFileSync(beforeApprovalPath, 'utf8'), /Code\.exe/);
    assert.equal(manager.getPendingSuggestions().aliases.length, 1);

    assert.equal(manager.approveAlias('code', 'Code.exe').success, true);
    assert.equal(manager.resolveAlias('code').target, 'Code.exe');
  });

  it('does not overwrite an approved correction without another approval', function() {
    const { manager } = createManager();
    assert.equal(manager.approveCorrection('open code', 'open vscode').success, true);

    manager.recordCorrection('open code', 'open visual studio');
    manager.recordCorrection('open code', 'open visual studio');
    assert.equal(
      manager.recordCorrection('open code', 'open visual studio').stage,
      'ready_to_learn'
    );
    assert.equal(manager.resolveCorrection('open code').resolved, 'open vscode');
  });

  it('blocks sensitive values from every persisted learning category', function() {
    const { manager } = createManager();

    assert.equal(manager.approveAlias('login', 'rakesh@example.com').success, false);
    assert.equal(manager.setPreference('browser', 'my password is hunter2').success, false);
    assert.equal(manager.approveCorrection('contact me', 'email rakesh@example.com').success, false);
    assert.equal(manager.approveWorkflow('private_flow', [
      'open browser',
      'email rakesh@example.com'
    ]).success, false);
    assert.equal(manager.recordUsage('rakesh@example.com').success, false);
  });

  it('quarantines invalid schemas and recreates a usable store', function() {
    const { dataDir } = createManager();
    const aliasPath = path.join(dataDir, 'learning', 'aliases.json');
    fs.writeFileSync(aliasPath, JSON.stringify({ aliases: [] }), 'utf8');

    const reloaded = new ActiveLearningManager({ app: { dataDir } });

    assert.deepEqual(reloaded.getAllAliases(), {});
    assert.ok(fs.readdirSync(path.dirname(aliasPath)).some(name =>
      /^aliases\.json\.corrupt-/.test(name)
    ));
    assert.equal(readSecureJsonFile(aliasPath, {}, {
      createIfMissing: false,
      validate: value => value && value.version === 1
    }).version, 1);
    assert.match(fs.readFileSync(aliasPath, 'utf8'), /OPENX_SECURE_JSON_V1/);
  });

  it('recovers the prior valid state when the primary JSON is corrupted', function() {
    const { dataDir, manager } = createManager();
    manager.approveAlias('code', 'Code.exe');
    manager.approveAlias('browser', 'chrome.exe');
    const aliasPath = path.join(dataDir, 'learning', 'aliases.json');
    fs.writeFileSync(aliasPath, '{bad json', 'utf8');

    const reloaded = new ActiveLearningManager({ app: { dataDir } });

    assert.equal(reloaded.resolveAlias('code').target, 'Code.exe');
    assert.equal(reloaded.resolveAlias('browser'), null);
  });

  it('does not leave temporary files after atomic writes', function() {
    const { dataDir, manager } = createManager();
    manager.setPreference('browser', 'chrome');
    manager.recordUsage('chrome');

    assert.equal(
      fs.readdirSync(path.join(dataDir, 'learning')).some(name => name.endsWith('.tmp')),
      false
    );
  });

  it('returns a bounded overview across all active learning stores', function() {
    const { manager } = createManager();

    manager.approveAlias('code', 'Code.exe');
    manager.setPreference('browser', 'chrome');
    manager.approveCorrection('open code', 'open vscode');
    manager.approveWorkflow('morning', ['open chrome', 'show calendar']);
    manager.recordUsage('chrome');
    manager.learnAlias('editor', 'Code.exe');
    manager.learnAlias('editor', 'Code.exe');
    manager.learnAlias('editor', 'Code.exe');

    const overview = manager.getLearningOverview({ limit: 1 });
    const commandOverview = manager.handleUserCommand('show learning overview');

    assert.equal(overview.enabled, true);
    assert.equal(overview.counts.aliases, 1);
    assert.equal(overview.counts.preferences, 1);
    assert.equal(overview.counts.corrections, 1);
    assert.equal(overview.counts.workflows, 1);
    assert.equal(overview.counts.pendingSuggestions, 1);
    assert.equal(overview.topUsed.length, 1);
    assert.equal(commandOverview.counts.pendingSuggestions, 1);
  });

  it('bounds in-memory suggestion buffers for noisy commands', function() {
    const { manager } = createManager();

    for (let index = 0; index < 260; index += 1) {
      manager.learnAlias(`alias ${index}`, `App${index}.exe`);
      manager.recordCorrection(`open app ${index}`, `open application ${index}`);
    }
    for (let index = 0; index < 140; index += 1) {
      manager.recordCommandSequence([`open app ${index}`, `close app ${index}`]);
    }

    assert.equal(manager.aliasStore.occurrenceBuffer.size, 200);
    assert.equal(manager.correctionStore.occurrenceBuffer.size, 200);
    assert.equal(manager.workflowStore.sequenceBuffer.size, 100);
  });
});
