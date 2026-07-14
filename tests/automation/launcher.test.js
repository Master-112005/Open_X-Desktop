const assert = require('assert');

describe('Automation Launcher', function() {
  function loadLauncherWithStubs(stubs = {}) {
    const childProcess = require('child_process');
    const fs = require('fs');
    const launcherPath = require.resolve('../../core/automation/common/launcher');
    const originalExecFileSync = childProcess.execFileSync;
    const originalSpawn = childProcess.spawn;
    const originalExistsSync = fs.existsSync;

    childProcess.execFileSync = stubs.execFileSync || originalExecFileSync;
    childProcess.spawn = stubs.spawn || originalSpawn;
    fs.existsSync = stubs.existsSync || originalExistsSync;
    delete require.cache[launcherPath];
    const launcher = require('../../core/automation/common/launcher');

    return {
      launcher,
      restore() {
        childProcess.execFileSync = originalExecFileSync;
        childProcess.spawn = originalSpawn;
        fs.existsSync = originalExistsSync;
        delete require.cache[launcherPath];
      }
    };
  }

  it('should launch command targets through Start-Process with escaped arguments', function() {
    let captured = null;
    const { launcher, restore } = loadLauncherWithStubs({
      execFileSync(command, args, options) {
        captured = { command, args, options };
      }
    });

    try {
      const result = launcher.launchTarget('chrome', ["O'Hara notes"]);

      assert.equal(result.success, true);
      assert.equal(result.method, 'powershell-start-process');
      assert.equal(result.classification, 'command-or-shell-target');
      assert.equal(captured.command, 'powershell.exe');
      assert.ok(captured.args.includes('-NonInteractive'));
      assert.ok(captured.args.includes('Start-Process -FilePath \'chrome\' -ArgumentList \'O\'\'Hara notes\''));
      assert.equal(captured.options.windowsHide, true);
    } finally {
      restore();
    }
  });

  it('should spawn existing executable paths without a PowerShell bridge', function() {
    let spawned = null;
    const { launcher, restore } = loadLauncherWithStubs({
      existsSync(target) {
        return String(target).toLowerCase() === 'c:\\tools\\sample.exe';
      },
      spawn(target, args, options) {
        spawned = { target, args, options };
        return {
          pid: 4242,
          once(event, handler) {
            spawned.errorHandler = { event, handler };
            return this;
          },
          unref() { spawned.unref = true; }
        };
      },
      execFileSync() {
        throw new Error('PowerShell should not run for executable paths');
      }
    });

    try {
      const result = launcher.launchTarget('C:\\Tools\\Sample.exe', ['--new-window']);

      assert.equal(result.method, 'spawn');
      assert.equal(result.classification, 'executable-path');
      assert.equal(result.pid, 4242);
      assert.deepEqual(spawned.args, ['--new-window']);
      assert.equal(spawned.options.detached, true);
      assert.equal(spawned.errorHandler.event, 'error');
      assert.equal(spawned.unref, true);
    } finally {
      restore();
    }
  });

  it('should reject unsafe launch input before dispatch', function() {
    const { launcher, restore } = loadLauncherWithStubs({
      execFileSync() {
        throw new Error('Launcher should not dispatch invalid input');
      }
    });

    try {
      assert.throws(() => launcher.launchTarget(''), /No target/);
      assert.throws(() => launcher.launchTarget('chrome\nbad'), /control characters/);
      assert.throws(() => launcher.launchTarget('chrome', 'not-array'), /arguments must be an array/);
      assert.throws(() => launcher.launchTarget('chrome', ['ok', 'bad\u0000arg']), /control characters/);
    } finally {
      restore();
    }
  });

  it('should classify Windows URI and AppUserModelID launches for verification metadata', function() {
    const { classifyTarget, normalizeTarget, normalizeArguments } = require('../../core/automation/common/launcher')._private;

    assert.equal(classifyTarget('ms-settings:display'), 'uri');
    assert.equal(classifyTarget('Microsoft.WindowsCalculator_8wekyb3d8bbwe!App'), 'app-user-model-id');
    assert.equal(normalizeTarget('  chrome  '), 'chrome');
    assert.deepEqual(normalizeArguments([1, false, 'value']), ['1', 'false', 'value']);
  });
});
