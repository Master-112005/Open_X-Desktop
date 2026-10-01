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

  it('should treat "all apps" and "everything" as every window when minimizing', function() {
    const { controller } = createController();
    let minimizedAll = 0;
    controller.session.minimizeAllWindows = () => {
      minimizedAll += 1;
      return { success: true, data: { action: 'minimizeAll', matchedWindow: 'all windows' } };
    };
    controller.session.minimizeWindow = () => {
      throw new Error('minimizeWindow should not be called for every-window targets');
    };

    controller.minimizeWindow('all apps');
    controller.minimizeWindow('all windows');
    controller.minimizeWindow('everything');

    assert.equal(minimizedAll, 3);
  });

  it('should show the desktop through the session controller', function() {
    const { controller } = createController();
    let called = 0;
    controller.session.showDesktop = () => {
      called += 1;
      return { success: true, data: { action: 'showDesktop', matchedWindow: 'desktop' } };
    };

    const result = controller.showDesktop();

    assert.equal(called, 1);
    assert.equal(result.data.action, 'showDesktop');
  });

  it('should treat every-window targets as restore-all and delegate named restores', function() {
    const { controller } = createController();
    let restoredAll = 0;
    let restoredNamed = 0;
    controller.session.restoreAllWindows = () => {
      restoredAll += 1;
      return { success: true, data: { action: 'restoreAll', matchedWindow: 'all windows' } };
    };
    controller.session.restoreWindow = windowName => {
      restoredNamed += 1;
      return { success: true, data: { action: 'restore', matchedWindow: windowName } };
    };

    controller.restoreWindow('all apps');
    controller.restoreWindow('everything');
    controller.restoreWindow('chrome');

    assert.equal(restoredAll, 2);
    assert.equal(restoredNamed, 1);
  });

  it('should switch windows through the session controller', function() {
    const { controller } = createController();
    let called = 0;
    controller.session.switchWindows = () => {
      called += 1;
      return { success: true, data: { action: 'switchWindows', matchedWindow: 'active window' } };
    };

    const result = controller.switchWindows();

    assert.equal(called, 1);
    assert.equal(result.data.action, 'switchWindows');
  });

  it('should snap a window through the session controller', function() {
    const { controller } = createController();
    let direction = '';
    controller.session.snapWindow = value => {
      direction = value;
      return { success: true, data: { action: value === 'right' ? 'snapRight' : 'snapLeft', matchedWindow: 'active window' } };
    };

    const result = controller.snapWindow('right');

    assert.equal(direction, 'right');
    assert.equal(result.data.action, 'snapRight');
  });
});
