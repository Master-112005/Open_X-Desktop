const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CrashRecoveryPolicy = require('../../apps/desktop/electron/crash-recovery');

describe('Crash Recovery Policy', function() {
  let directory;
  let statePath;

  beforeEach(function() {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-recovery-'));
    statePath = path.join(directory, 'crash-recovery.json');
  });

  afterEach(function() {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('should allow only a bounded number of restarts inside the crash window', function() {
    const policy = new CrashRecoveryPolicy({ statePath, maxRestarts: 3, windowMs: 1000 });

    assert.equal(policy.requestRestart(1000), true);
    assert.equal(policy.requestRestart(1100), true);
    assert.equal(policy.requestRestart(1200), true);
    assert.equal(policy.requestRestart(1300), false);
  });

  it('should permit recovery after the crash window expires', function() {
    const policy = new CrashRecoveryPolicy({ statePath, maxRestarts: 2, windowMs: 100 });

    assert.equal(policy.requestRestart(1000), true);
    assert.equal(policy.requestRestart(1050), true);
    assert.equal(policy.requestRestart(1200), true);
  });

  it('should reset crash history after a stable runtime', function() {
    const policy = new CrashRecoveryPolicy({ statePath, maxRestarts: 1, windowMs: 1000 });

    assert.equal(policy.requestRestart(1000), true);
    assert.equal(policy.requestRestart(1100), false);
    policy.markStable(1200);
    assert.equal(policy.requestRestart(1300), true);
  });

  it('should keep recovered crash diagnostics after clearing the restart budget', function() {
    const policy = new CrashRecoveryPolicy({ statePath, maxRestarts: 2, windowMs: 1000 });

    assert.equal(policy.requestRestart(1000, { component: 'assistant', reason: 'startup failed' }), true);
    policy.markStable(1200);
    const diagnostics = policy.getDiagnostics(1300);

    assert.deepEqual(diagnostics.crashTimestamps, []);
    assert.deepEqual(diagnostics.crashRecords, []);
    assert.equal(diagnostics.recoveredCrashRecords.length, 1);
    assert.equal(diagnostics.recoveredCrashRecords[0].component, 'assistant');
    assert.equal(diagnostics.lastCrash.reason, 'startup failed');
    assert.equal(diagnostics.stableAt, 1200);
  });

  it('should recover safely from corrupt state data', function() {
    fs.writeFileSync(statePath, '{bad json', 'utf8');
    const policy = new CrashRecoveryPolicy({ statePath, maxRestarts: 1, windowMs: 1000 });

    assert.equal(policy.requestRestart(1000), true);
    assert.deepEqual(JSON.parse(fs.readFileSync(statePath, 'utf8')).crashTimestamps, [1000]);
  });

  it('should ignore future timestamps when reading restart history', function() {
    fs.writeFileSync(statePath, JSON.stringify({ crashTimestamps: [1000, 5000] }), 'utf8');
    const policy = new CrashRecoveryPolicy({ statePath, maxRestarts: 2, windowMs: 1000 });

    assert.equal(policy.requestRestart(1100), true);
    assert.deepEqual(JSON.parse(fs.readFileSync(statePath, 'utf8')).crashTimestamps, [1000, 1100]);
  });

  it('should expose bounded recovery state for diagnostics', function() {
    const policy = new CrashRecoveryPolicy({ statePath, maxRestarts: 2, windowMs: 1000 });

    assert.equal(policy.requestRestart(1000), true);
    assert.deepEqual(policy.getState(1100), {
      blocked: false,
      crashTimestamps: [1000],
      remainingRestarts: 1
    });
  });

  it('should persist compact crash metadata for startup diagnostics', function() {
    const policy = new CrashRecoveryPolicy({ statePath, maxRestarts: 1, windowMs: 1000 });
    const longReason = 'x'.repeat(500);

    assert.equal(policy.requestRestart(1000, {
      origin: 'startup',
      component: 'main-process',
      reason: longReason,
      pid: 123,
      uptimeMs: 4567,
      assistantInitialized: true,
      voiceState: 'LISTENING',
      windows: { chat: true, voice: true, planner: false, gallery: true, timer: false },
      memory: { rss: 10, heapUsed: 20, external: 30 }
    }), true);

    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.equal(state.lastCrash.origin, 'startup');
    assert.equal(state.lastCrash.component, 'main-process');
    assert.equal(state.lastCrash.reason.length, 180);
    assert.equal(state.lastCrash.timestamp, 1000);
    assert.equal(state.lastCrash.pid, 123);
    assert.equal(state.lastCrash.assistantInitialized, true);
    assert.equal(state.lastCrash.voiceState, 'LISTENING');
    assert.deepEqual(state.lastCrash.windows, { chat: true, voice: true, planner: false, gallery: true, timer: false });
    assert.deepEqual(state.lastCrash.memory, { rss: 10, heapUsed: 20, external: 30 });
  });

  it('should expose detailed crash recovery diagnostics without changing restart state shape', function() {
    const policy = new CrashRecoveryPolicy({ statePath, maxRestarts: 2, windowMs: 1000 });

    assert.equal(policy.requestRestart(1000, { origin: 'startup', component: 'assistant', reason: 'boot failed' }), true);
    const diagnostics = policy.getDiagnostics(1100);

    assert.equal(diagnostics.blocked, false);
    assert.deepEqual(diagnostics.crashTimestamps, [1000]);
    assert.equal(diagnostics.crashRecords.length, 1);
    assert.equal(diagnostics.lastCrash.component, 'assistant');
    assert.equal(diagnostics.windowMs, 1000);
    assert.equal(diagnostics.maxRestarts, 2);
  });
});
