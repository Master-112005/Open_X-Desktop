'use strict';

const assert = require('assert');

const {
  AsyncHelpers,
  Cancellation,
  ConfigurationLoader,
  DeepClone,
  ErrorHelpers,
  IdGenerator,
  LoggerHelpers,
  ObjectFreeze,
  PerformanceTracker,
  ServiceContainer,
  Stopwatch,
  Timer,
  UTILS_VERSION,
  ValidationHelpers
} = require('../../core/assistant/utils');

describe('Assistant Utility Layer', function() {
  it('exports a versioned utility surface', function() {
    assert.match(UTILS_VERSION, /^\d+\.\d+\.\d+$/);
  });

  it('handles async timeout, sleep, and deferred work consistently', async function() {
    const deferred = AsyncHelpers.defer();
    setTimeout(() => deferred.resolve('ok'), 1);
    assert.equal(await AsyncHelpers.withTimeout(deferred.promise, 50), 'ok');
    assert.equal(await AsyncHelpers.sleep(1, 'done'), 'done');
    await assert.rejects(
      () => AsyncHelpers.withTimeout(new Promise(() => {}), 1),
      error => error.code === 'operation_timeout'
    );
  });

  it('links cancellation signals and exposes deadline helpers', async function() {
    const parent = new AbortController();
    const child = new AbortController();
    const cleanup = Cancellation.linkAbortSignal(parent.signal, child);
    parent.abort('stop');
    cleanup();

    assert.equal(child.signal.aborted, true);
    assert.equal(Cancellation.isCancellationError(Cancellation.createCancellationError(child.signal)), true);
    assert.ok(Cancellation.deadlineContext(100).deadlineAt >= Date.now());
    await assert.rejects(
      () => Cancellation.raceWithSignal(child.signal, () => Promise.resolve('never')),
      error => error.code === 'operation_cancelled'
    );
  });

  it('deep merges config without mutating defaults', function() {
    const loader = new ConfigurationLoader({
      chat: { maxHistory: 250, theme: 'dark' },
      feature: true
    });
    const loaded = loader.load({ chat: { theme: 'light' } });

    assert.deepEqual(loaded, {
      chat: { maxHistory: 250, theme: 'light' },
      feature: true
    });
    assert.equal(loader.defaults.chat.theme, 'dark');
  });

  it('clones and freezes cyclic objects safely', function() {
    const input = { name: 'root', child: { value: 1 } };
    input.self = input;
    const cloned = DeepClone(input);

    assert.notStrictEqual(cloned, input);
    assert.strictEqual(cloned.self, cloned);
    ObjectFreeze(cloned);
    assert.equal(Object.isFrozen(cloned), true);
    assert.equal(Object.isFrozen(cloned.child), true);
  });

  it('serializes and logs errors with sensitive fields redacted', function() {
    const error = new Error('failed');
    error.details = { apiKey: 'secret', nested: { token: 'hidden', visible: 'ok' } };
    const serialized = ErrorHelpers.serializeError(error);

    assert.equal(serialized.details.apiKey, '[redacted]');
    assert.equal(serialized.details.nested.token, '[redacted]');

    const entries = [];
    const logger = LoggerHelpers.safeLogger({
      info: (message, data) => entries.push({ message, data })
    });
    logger.info('test', { password: 'hidden', value: 'ok' });
    assert.equal(entries[0].data.password, '[redacted]');
  });

  it('generates unique safe ids', function() {
    const generator = new IdGenerator({ prefix: 'Command!', now: () => 1000, random: () => 0.5 });
    const first = generator.next();
    const second = generator.next();

    assert.match(first, /^command_/);
    assert.notEqual(first, second);
  });

  it('tracks bounded performance records and summaries', function() {
    const tracker = new PerformanceTracker({ maxRecords: 2, now: () => 10 });
    tracker.record('fast', 1, { token: 'secret' });
    tracker.record('slow', 9);
    tracker.record('latest', 5);

    assert.equal(tracker.list(10).length, 2);
    assert.equal(tracker.list(10)[0].name, 'slow');
    assert.equal(tracker.summary().count, 2);
    assert.equal(tracker.clear(), 2);
  });

  it('detects service cycles and supports scoped containers', function() {
    const root = new ServiceContainer();
    root.register('config', { ready: true });
    const child = root.createScope();
    assert.equal(child.resolve('config').ready, true);

    child.register('a', container => container.resolve('a'));
    assert.throws(() => child.resolve('a'), /Circular service dependency/);
    child.unregister('a');
    assert.equal(child.has('a'), false);
  });

  it('tracks stopwatch laps and timer state', async function() {
    let now = 100;
    const stopwatch = new Stopwatch(() => now);
    stopwatch.start();
    now = 125.25;
    assert.equal(stopwatch.lap('stage').elapsedMs, 25.25);
    assert.equal(stopwatch.snapshot().laps.length, 1);
    assert.equal(stopwatch.stop(), 25.25);

    const timer = new Timer();
    const wait = timer.wait(1);
    assert.equal(timer.active(), true);
    await wait;
    assert.equal(timer.active(), false);
  });

  it('provides stricter validation helpers', function() {
    assert.equal(ValidationHelpers.isPlainObject({}), true);
    assert.equal(ValidationHelpers.isPlainObject(new Date()), false);
    assert.equal(ValidationHelpers.clampNumber(150, 0, 100), 100);
    assert.equal(ValidationHelpers.finiteNumber('7'), 7);
    assert.deepEqual(ValidationHelpers.optionalArray('nope', [1]), [1]);
    assert.equal(ValidationHelpers.compactString('a '.repeat(200), 20).endsWith('...'), true);
  });
});
