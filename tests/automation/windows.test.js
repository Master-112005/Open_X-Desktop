const assert = require('assert');
const WindowsController = require('../../core/automation/windows');
const ActionVerifier = require('../../core/automation/common/action-verification');

function createController(options = {}) {
  const calls = [];
  const controller = new WindowsController({
    logging: { level: 'error' },
    windows: {
      commandRunner: (file, args, execOptions) => {
        calls.push({ file, args, execOptions });
        if (options.fail) {
          throw new Error(options.fail);
        }
        return '';
      },
      commandTimeoutMs: 1234,
      shutdownDelaySeconds: options.shutdownDelaySeconds,
      restartDelaySeconds: options.restartDelaySeconds,
      dryRun: options.dryRun === true
    }
  });
  return { controller, calls };
}

describe('WindowsController', function() {
  it('should dispatch shutdown through shutdown.exe argument arrays', function() {
    const { controller, calls } = createController({ shutdownDelaySeconds: 7 });

    const result = controller.shutdown();

    assert.equal(result.success, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].file, 'shutdown.exe');
    assert.deepEqual(calls[0].args, ['/s', '/t', '7', '/c', 'OpenX initiated shutdown']);
    assert.equal(calls[0].execOptions.timeout, 1234);
    assert.equal(result.data.action, 'shutdown');
    assert.equal(result.data.delay, 7);
    assert.equal(result.data.verification.status, 'unknown');
    assert.equal(result.data.verification.check, 'windows-shutdown-request');
  });

  it('should dispatch restart, lock, sleep, hibernate, and logoff without shell strings', function() {
    const { controller, calls } = createController({ restartDelaySeconds: 4 });

    controller.restart();
    controller.lock();
    controller.sleep();
    controller.hibernate();
    controller.logOff();

    assert.deepEqual(calls.map(call => call.file), [
      'shutdown.exe',
      'rundll32.exe',
      'rundll32.exe',
      'shutdown.exe',
      'shutdown.exe'
    ]);
    assert.deepEqual(calls[0].args, ['/r', '/t', '4', '/c', 'OpenX initiated restart']);
    assert.deepEqual(calls[1].args, ['user32.dll,LockWorkStation']);
    assert.deepEqual(calls[2].args, ['powrprof.dll,SetSuspendState', '0,1,0']);
    assert.deepEqual(calls[3].args, ['/h']);
    assert.deepEqual(calls[4].args, ['/l']);
  });

  it('should support dry-run power requests for validation without dispatching', function() {
    const { controller, calls } = createController({ dryRun: true });

    const result = controller.lock();

    assert.equal(result.success, true);
    assert.equal(calls.length, 0);
    assert.equal(result.data.dryRun, true);
  });

  it('should return structured failure metadata when Windows rejects a request', function() {
    const { controller } = createController({ fail: 'Access is denied' });

    const result = controller.hibernate();

    assert.equal(result.success, false);
    assert.equal(result.error, 'Access is denied');
    assert.equal(result.data.action, 'hibernate');
    assert.equal(result.data.verification.status, 'failed');
    assert.equal(result.data.verification.check, 'windows-hibernate-request');
  });

  it('should preserve controller dispatch evidence in action verification', function() {
    const { controller } = createController({ dryRun: true });
    const verifier = new ActionVerifier({});

    const verified = verifier.verify('system.lock', {}, controller.lock());

    assert.equal(verified.success, true);
    assert.equal(verified.verification.status, 'unknown');
    assert.equal(verified.verification.check, 'windows-lock-request');
    assert.equal(verified.verification.blocking, false);
  });
});
