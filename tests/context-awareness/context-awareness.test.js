const assert = require('assert');

function silentLogger() {
  return {
    info() {},
    warn() {},
    error() {},
    debug() {}
  };
}

function createSignalRecorder() {
  const events = [];
  return {
    SIGNAL_EVENTS: require('../../core/context-awareness/signals').SIGNAL_EVENTS,
    events,
    emit(event, payload) {
      events.push({ event, payload });
      return { event, payload, timestamp: Date.now() };
    }
  };
}

describe('Context Awareness', function() {
  it('should expose required signal events and support subscriptions', function() {
    const { EnvironmentSignals, SIGNAL_EVENTS } = require('../../core/context-awareness/signals');
    const localSignals = new EnvironmentSignals();
    const received = [];

    const unsubscribe = localSignals.subscribe(SIGNAL_EVENTS.ACTIVE_WINDOW_CHANGED, envelope => {
      received.push(envelope);
    });

    localSignals.emit(SIGNAL_EVENTS.ACTIVE_WINDOW_CHANGED, { app: 'Code.exe' });
    unsubscribe();
    localSignals.emit(SIGNAL_EVENTS.ACTIVE_WINDOW_CHANGED, { app: 'Chrome.exe' });

    assert.equal(received.length, 1);
    assert.equal(received[0].payload.app, 'Code.exe');
  });

  it('should isolate signal subscriber failures and continue wildcard delivery', function() {
    const { EnvironmentSignals, SIGNAL_EVENTS } = require('../../core/context-awareness/signals');
    const warnings = [];
    const localSignals = new EnvironmentSignals({
      logger: {
        warn(...args) {
          warnings.push(args.join(' '));
        }
      },
      now: () => 1234
    });
    const wildcard = [];
    const direct = [];

    localSignals.subscribe(SIGNAL_EVENTS.PROCESS_STARTED, () => {
      throw new Error('listener failed');
    });
    localSignals.subscribe(SIGNAL_EVENTS.PROCESS_STARTED, envelope => direct.push(envelope));
    localSignals.subscribe('*', envelope => wildcard.push(envelope));

    const envelope = localSignals.emit(SIGNAL_EVENTS.PROCESS_STARTED, { name: 'Code.exe' });

    assert.equal(envelope.timestamp, 1234);
    assert.equal(envelope.known, true);
    assert.equal(direct.length, 1);
    assert.equal(wildcard.length, 1);
    assert.ok(warnings.some(message => message.includes('Subscriber failed')));
    assert.equal(localSignals.getDiagnostics().subscriberErrors, 1);
  });

  it('should normalize signal names, freeze envelopes, and bound payload keys', function() {
    const { EnvironmentSignals, SIGNAL_EVENTS } = require('../../core/context-awareness/signals');
    const localSignals = new EnvironmentSignals({ now: () => 2000 });
    const payload = Object.fromEntries(Array.from({ length: 80 }, (_, index) => [`key${index}`, index]));
    const received = [];

    localSignals.subscribe(`  ${SIGNAL_EVENTS.ACTIVE_WINDOW_CHANGED}\u0000  `, envelope => received.push(envelope));
    const envelope = localSignals.emit(`  ${SIGNAL_EVENTS.ACTIVE_WINDOW_CHANGED}\u0000  `, payload);

    assert.equal(envelope.event, SIGNAL_EVENTS.ACTIVE_WINDOW_CHANGED);
    assert.equal(Object.keys(envelope.payload).length, 64);
    assert.equal(Object.isFrozen(envelope), true);
    assert.equal(Object.isFrozen(envelope.payload), true);
    assert.equal(received.length, 1);
  });

  it('should ignore invalid signal subscriptions and make unsubscribe idempotent', function() {
    const { EnvironmentSignals, SIGNAL_EVENTS } = require('../../core/context-awareness/signals');
    const localSignals = new EnvironmentSignals();
    let calls = 0;

    const ignoredUnsubscribe = localSignals.subscribe('', () => {
      calls += 1;
    });
    const unsubscribe = localSignals.subscribe(SIGNAL_EVENTS.MODE_CHANGED, () => {
      calls += 1;
    });

    assert.equal(ignoredUnsubscribe(), undefined);
    assert.equal(localSignals.listenerCount(SIGNAL_EVENTS.MODE_CHANGED), 1);
    assert.equal(unsubscribe(), true);
    assert.equal(unsubscribe(), false);
    localSignals.emit(SIGNAL_EVENTS.MODE_CHANGED, { to: 'DEV_MODE' });

    assert.equal(calls, 0);
    assert.equal(localSignals.listenerCount(SIGNAL_EVENTS.MODE_CHANGED), 0);
    assert.equal(localSignals.getDiagnostics().unsubscriptions, 1);
  });

  it('should drop empty signal names without notifying wildcard listeners', function() {
    const { EnvironmentSignals } = require('../../core/context-awareness/signals');
    const warnings = [];
    const localSignals = new EnvironmentSignals({
      logger: {
        warn(...args) {
          warnings.push(args.join(' '));
        }
      }
    });
    let wildcardCalls = 0;

    localSignals.subscribe('*', () => {
      wildcardCalls += 1;
    });

    assert.equal(localSignals.emit('   ', { ignored: true }), null);
    assert.equal(wildcardCalls, 0);
    assert.equal(localSignals.getDiagnostics().dropped, 1);
    assert.ok(warnings.some(message => message.includes('Dropped signal')));
  });

  it('should categorize known applications', function() {
    const registry = require('../../core/context-awareness/app-registry');

    assert.ok(registry.DEV_APPS.includes('Code.exe'));
    assert.ok(registry.getCategoriesForApp('code.exe').includes('DEV_APPS'));
    assert.ok(registry.getCategoriesForApp('OUTLOOK.EXE').includes('WORK_APPS'));
    assert.ok(registry.getCategoriesForApp('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe').includes('BROWSER_APPS'));
    assert.ok(registry.getCategoriesForApp('visual studio code').includes('DEV_APPS'));
    assert.ok(registry.getCategoriesForApp('teams').includes('COMMUNICATION_APPS'));
    assert.equal(registry.normalizeProcessName('PowerPoint'), 'powerpnt.exe');
    assert.deepEqual(registry.getAppProfile('unknown.exe').categories, []);
    assert.equal(registry.isKnownApp('unknown.exe'), false);
  });

  it('should detect active window changes with a 500ms polling contract', async function() {
    const activeWindow = require('../../core/context-awareness/active-window');
    const signalRecorder = createSignalRecorder();
    const monitor = activeWindow.createMonitor({
      logger: silentLogger(),
      signals: signalRecorder,
      activeWin: async () => ({
        title: 'OpenX - Visual Studio Code',
        owner: {
          name: 'Code.exe',
          path: 'C:\\Program Files\\Microsoft VS Code\\Code.exe',
          processId: 1234
        }
      })
    });

    const received = [];
    monitor.subscribe(windowInfo => received.push(windowInfo));
    await monitor.pollOnce();

    assert.equal(activeWindow.ACTIVE_WINDOW_POLL_MS, 500);
    assert.equal(monitor.getCurrentWindow().app, 'Code.exe');
    assert.equal(monitor.getCurrentWindow().pid, 1234);
    assert.equal(received.length, 1);
    assert.equal(signalRecorder.events[0].event, signalRecorder.SIGNAL_EVENTS.ACTIVE_WINDOW_CHANGED);
  });

  it('should propagate fullscreen changes from active window detection', async function() {
    const activeWindow = require('../../core/context-awareness/active-window');
    const signalRecorder = createSignalRecorder();
    const monitor = activeWindow.createMonitor({
      logger: silentLogger(),
      signals: signalRecorder,
      activeWin: async () => ({
        title: 'Fullscreen Game',
        fullscreen: true,
        owner: {
          name: 'game.exe',
          path: 'C:\\Games\\game.exe',
          processId: 9001
        }
      })
    });

    await monitor.pollOnce();

    assert.equal(monitor.getCurrentWindow().fullscreen, true);
    assert.equal(signalRecorder.events[0].payload.fullscreen, true);
  });

  it('should suppress duplicate active window events while preserving handles', async function() {
    const activeWindow = require('../../core/context-awareness/active-window');
    const signalRecorder = createSignalRecorder();
    let reads = 0;
    const monitor = activeWindow.createMonitor({
      logger: silentLogger(),
      signals: signalRecorder,
      now: () => 1000 + reads,
      reader: async () => {
        reads += 1;
        return {
          id: 991,
          title: 'OpenX - Visual Studio Code',
          owner: {
            name: 'Code.exe',
            path: 'C:\\Program Files\\Microsoft VS Code\\Code.exe',
            processId: 1234
          }
        };
      }
    });

    await monitor.pollOnce();
    await monitor.pollOnce();

    assert.equal(signalRecorder.events.length, 1);
    assert.equal(monitor.getCurrentWindow().handle, 991);
    assert.equal(monitor.getCurrentWindow().pid, 1234);
  });

  it('should back off repeated active window failures to reduce resource use', async function() {
    const activeWindow = require('../../core/context-awareness/active-window');
    const warnings = [];
    let now = 1000;
    let reads = 0;
    const monitor = activeWindow.createMonitor({
      logger: {
        ...silentLogger(),
        warn(...args) {
          warnings.push(args.join(' '));
        }
      },
      signals: createSignalRecorder(),
      now: () => now,
      failureBackoffMs: 2000,
      maxFailureBackoffMs: 5000,
      reader: async () => {
        reads += 1;
        throw new Error('reader unavailable');
      }
    });

    await monitor.pollOnce();
    await monitor.pollOnce();
    now += 1999;
    await monitor.pollOnce();
    now += 2;
    await monitor.pollOnce();

    assert.equal(reads, 2);
    assert.equal(warnings.length, 1);
    assert.equal(monitor.getCurrentWindow(), null);
  });

  it('should sanitize active window payloads before publishing them', async function() {
    const activeWindow = require('../../core/context-awareness/active-window');
    const signalRecorder = createSignalRecorder();
    const monitor = activeWindow.createMonitor({
      logger: silentLogger(),
      signals: signalRecorder,
      reader: async () => ({
        id: 'bad',
        title: `Bad\u0000Title ${'x'.repeat(400)}`,
        owner: {
          name: 'Code.exe\u0007',
          path: `C:\\${'p'.repeat(5000)}`,
          processId: -1
        }
      })
    });

    await monitor.pollOnce();
    const current = monitor.getCurrentWindow();

    assert.equal(current.app, 'Code.exe');
    assert.equal(current.pid, null);
    assert.equal(current.handle, null);
    assert.ok(current.title.length <= 260);
    assert.ok(current.path.length <= 4096);
    assert.doesNotMatch(current.title, /\u0000/);
  });

  it('should track process start and stop events', async function() {
    const processMonitor = require('../../core/context-awareness/process-monitor');
    const signalRecorder = createSignalRecorder();
    const snapshots = [
      JSON.stringify([{ ProcessId: 1, Name: 'Code.exe', ExecutablePath: 'C:\\Code.exe' }]),
      JSON.stringify([
        { ProcessId: 1, Name: 'Code.exe', ExecutablePath: 'C:\\Code.exe' },
        { ProcessId: 2, Name: 'Spotify.exe', ExecutablePath: 'C:\\Spotify.exe' }
      ]),
      JSON.stringify([{ ProcessId: 2, Name: 'Spotify.exe', ExecutablePath: 'C:\\Spotify.exe' }])
    ];

    const monitor = processMonitor.createMonitor({
      logger: silentLogger(),
      signals: signalRecorder,
      runner: async () => snapshots.shift()
    });

    await monitor.pollOnce();
    await monitor.pollOnce();
    await monitor.pollOnce();

    assert.equal(monitor.isRunning('Spotify.exe'), true);
    assert.equal(monitor.isRunning('Code.exe'), false);
    assert.ok(monitor.getProcesses().find(processInfo => processInfo.name === 'Spotify.exe').appProfile.known);
    assert.ok(signalRecorder.events.some(item => item.event === signalRecorder.SIGNAL_EVENTS.PROCESS_STARTED && item.payload.name === 'Spotify.exe'));
    assert.ok(signalRecorder.events.some(item => item.event === signalRecorder.SIGNAL_EVENTS.PROCESS_STOPPED && item.payload.name === 'Code.exe'));
  });

  it('should isolate process monitor subscriber failures', async function() {
    const processMonitor = require('../../core/context-awareness/process-monitor');
    const warnings = [];
    const received = [];
    const monitor = processMonitor.createMonitor({
      logger: {
        ...silentLogger(),
        warn(...args) {
          warnings.push(args.join(' '));
        }
      },
      signals: createSignalRecorder(),
      runner: async () => JSON.stringify([{ ProcessId: 7, Name: 'PowerPoint.exe', ExecutablePath: 'C:\\PowerPoint.exe' }])
    });

    monitor.subscribe(() => {
      throw new Error('process listener failed');
    });
    monitor.subscribe(event => received.push(event.process.name));

    await monitor.pollOnce();

    assert.deepEqual(received, ['PowerPoint.exe']);
    assert.ok(warnings.some(message => message.includes('Subscriber failed')));
  });

  it('should update microphone activity in context snapshots', function() {
    const { ContextEngine } = require('../../core/context-awareness/context-engine');
    const signalRecorder = createSignalRecorder();
    const subscriptions = new Map();
    signalRecorder.subscribe = (event, callback) => {
      if (!subscriptions.has(event)) subscriptions.set(event, []);
      subscriptions.get(event).push(callback);
      return () => {
        const callbacks = subscriptions.get(event) || [];
        const index = callbacks.indexOf(callback);
        if (index !== -1) callbacks.splice(index, 1);
      };
    };
    signalRecorder.emit = (event, payload) => {
      signalRecorder.events.push({ event, payload });
      const envelope = { event, payload, timestamp: Date.now() };
      (subscriptions.get(event) || []).forEach(callback => callback(envelope));
      return envelope;
    };
    const engine = new ContextEngine({
      logger: silentLogger(),
      signals: signalRecorder
    });

    engine.start();
    signalRecorder.emit(signalRecorder.SIGNAL_EVENTS.MICROPHONE_ACTIVITY_CHANGED, { active: true });

    assert.equal(engine.getSnapshot().microphoneActive, true);
    engine.stop();
  });

  it('should sanitize active context snapshots and preserve path and pid', function() {
    const { ContextEngine } = require('../../core/context-awareness/context-engine');
    const engine = new ContextEngine({
      logger: silentLogger(),
      signals: createSignalRecorder(),
      now: () => 2000
    });

    engine.update({
      activeApp: 'Code.exe\u0000',
      activeTitle: `OpenX ${'x'.repeat(400)}`,
      activePath: `C:\\${'p'.repeat(5000)}`,
      activePid: '42',
      timestamp: -1
    }, 'active-window');

    const snapshot = engine.getSnapshot();
    assert.equal(snapshot.activeApp, 'Code.exe');
    assert.equal(snapshot.activePid, 42);
    assert.ok(snapshot.activeTitle.length <= 260);
    assert.ok(snapshot.activePath.length <= 4096);
    assert.equal(snapshot.timestamp, 2000);
  });

  it('should keep running apps unique by process name casing', function() {
    const { ContextEngine } = require('../../core/context-awareness/context-engine');
    const engine = new ContextEngine({
      logger: silentLogger(),
      signals: createSignalRecorder()
    });

    engine._handleProcessStarted({ name: 'Code.exe' });
    engine._handleProcessStarted({ name: 'code.exe' });
    engine._handleProcessStarted({ name: 'Spotify.exe' });
    engine._handleProcessStopped({ name: 'CODE.EXE' });

    assert.deepEqual(engine.getSnapshot().runningApps, ['Spotify.exe']);
  });

  it('should isolate subscriber failures while publishing context updates', function() {
    const { ContextEngine } = require('../../core/context-awareness/context-engine');
    const warnings = [];
    const received = [];
    const engine = new ContextEngine({
      logger: {
        ...silentLogger(),
        warn(...args) {
          warnings.push(args.join(' '));
        }
      },
      signals: createSignalRecorder()
    });

    engine.subscribe(() => {
      throw new Error('subscriber exploded');
    });
    engine.subscribe(snapshot => received.push(snapshot.activeApp));
    engine.update({ activeApp: 'Code.exe' }, 'active-window');

    assert.deepEqual(received, ['Code.exe']);
    assert.ok(warnings.some(message => message.includes('Subscriber failed')));
  });

  it('should keep activity history bounded and compact', function() {
    const { ACTIVITY_HISTORY_LIMIT, ContextEngine } = require('../../core/context-awareness/context-engine');
    const engine = new ContextEngine({
      logger: silentLogger(),
      signals: createSignalRecorder()
    });

    for (let index = 0; index < ACTIVITY_HISTORY_LIMIT + 5; index += 1) {
      engine.update({
        activeApp: 'Code.exe',
        activeTitle: `Title ${index}`,
        secretObject: { token: 'do-not-store' },
        longText: 'x'.repeat(400)
      }, 'active-window');
    }

    const history = engine.getSnapshot().activityHistory;
    assert.equal(history.length, ACTIVITY_HISTORY_LIMIT);
    assert.equal(history[0].payload.activeTitle, 'Title 5');
    assert.equal(history[0].payload.secretObject, undefined);
    assert.ok(history[0].payload.longText.length <= 260);
  });

  it('should continue stopping even when a signal unsubscribe fails', function() {
    const { ContextEngine } = require('../../core/context-awareness/context-engine');
    const warnings = [];
    const signalRecorder = {
      SIGNAL_EVENTS: require('../../core/context-awareness/signals').SIGNAL_EVENTS,
      subscribe() {
        return () => {
          throw new Error('unsubscribe failed');
        };
      }
    };
    const engine = new ContextEngine({
      logger: {
        ...silentLogger(),
        warn(...args) {
          warnings.push(args.join(' '));
        }
      },
      signals: signalRecorder
    });

    engine.start();
    engine.stop();

    assert.equal(engine.unsubscribers.length, 0);
    assert.ok(warnings.length > 0);
  });
});
