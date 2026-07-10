const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SecurityLockManager = require('../../core/security/SecurityLockManager');
const AppLockEnforcer = require('../../core/security/AppLockEnforcer');
const AppController = require('../../core/automation/apps');
const AutomationEngine = require('../../core/automation');

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'openx-locks-'));
}

describe('Security Locks', function() {
  it('should hash app passwords and expose only sanitized lock metadata', function() {
    const root = tempRoot();
    const manager = new SecurityLockManager({
      app: { dataDir: root },
      logging: { console: false, file: false }
    });

    const saved = manager.upsertLock({
      type: 'app',
      target: 'Chrome',
      displayName: 'Chrome',
      password: 'secret123'
    });

    assert.equal(saved.success, true);
    assert.equal(saved.data.lock.displayName, 'Chrome');
    assert.equal(saved.data.lock.passwordHash, undefined);
    const raw = fs.readFileSync(path.join(root, 'security', 'locks.json'), 'utf8');
    assert.doesNotMatch(raw, /secret123/);
    assert.match(raw, /pbkdf2/);
    assert.equal(manager.unlock({ type: 'app', target: 'chrome', password: 'secret123' }).success, true);
    assert.equal(manager.unlock({ type: 'app', target: 'chrome', password: 'wrong' }).success, false);
  });

  it('should block assistant app opens until a password is provided', function() {
    const root = tempRoot();
    const manager = new SecurityLockManager({
      app: { dataDir: root },
      logging: { console: false, file: false }
    });
    manager.upsertLock({ type: 'app', target: 'chrome', displayName: 'Chrome', password: '1234' });
    const apps = new AppController({
      securityLocks: manager,
      logging: { console: false, file: false }
    });

    const blocked = apps.open('chrome');
    assert.equal(blocked.success, false);
    assert.equal(blocked.needsClarification, true);
    assert.equal(blocked.data.clarificationType, 'security.unlock');

    const wrong = apps.open('chrome', { password: '0000' });
    assert.equal(wrong.success, false);
    assert.match(wrong.error, /Incorrect app password/);
  });

  it('should normalize Instagram typo locks for assistant app opens', function() {
    const root = tempRoot();
    const manager = new SecurityLockManager({
      app: { dataDir: root },
      logging: { console: false, file: false }
    });
    manager.upsertLock({ type: 'app', target: 'instagram', displayName: 'Instagram', password: '1234' });
    const apps = new AppController({
      securityLocks: manager,
      logging: { console: false, file: false }
    });

    const blocked = apps.open('instagran');
    assert.equal(blocked.success, false);
    assert.equal(blocked.needsClarification, true);
    assert.equal(blocked.data.target, 'instagram');
  });

  it('should close newly launched locked apps and ignore startup-visible windows', async function() {
    const manager = {
      listLocks: () => [{ type: 'app', target: 'instagram', displayName: 'Instagram', enabled: true }]
    };
    const calls = [];
    let visible = true;
    const apps = {
      findVisibleApp: () => visible ? { Id: 44, ProcessName: 'Instagram', MainWindowTitle: 'Instagram' } : null,
      close: (target, options) => calls.push(['close', target, options.targetProcessId]),
      open: (target, options) => calls.push(['open', target, options.securityUnlocked])
    };
    const enforcer = new AppLockEnforcer({
      securityLocks: manager,
      apps,
      onLockedAppDetected: async () => true
    });

    await enforcer.scan();
    await enforcer.scan();
    assert.deepEqual(calls, []);

    visible = false;
    await enforcer.scan();
    visible = true;
    await enforcer.scan();

    assert.deepEqual(calls, [
      ['close', 'instagram', 44],
      ['open', 'instagram', true]
    ]);
  });

  it('should not prompt immediately when a new lock is added for an already-open app', async function() {
    let locked = false;
    const manager = {
      listLocks: () => locked ? [{ type: 'app', target: 'instagram', displayName: 'Instagram', enabled: true }] : []
    };
    const calls = [];
    const apps = {
      findVisibleApp: () => ({ Id: 44, ProcessName: 'Instagram', MainWindowTitle: 'Instagram' }),
      close: (target) => calls.push(['close', target]),
      open: (target) => calls.push(['open', target])
    };
    const enforcer = new AppLockEnforcer({
      securityLocks: manager,
      apps,
      onLockedAppDetected: async () => true
    });

    await enforcer.scan();
    locked = true;
    await enforcer.scan();
    await enforcer.scan();

    assert.deepEqual(calls, []);
  });

  it('should use web app fallback before searching folders for app opens', async function() {
    const engine = new AutomationEngine({
      app: { dataDir: tempRoot() },
      logging: { console: false, file: false }
    });
    let folderSearched = false;
    engine.apps.open = async () => ({ success: false, error: 'App not installed' });
    engine.folders.open = () => {
      folderSearched = true;
      return { success: false, needsClarification: true, error: 'Wrong folder search' };
    };
    engine.browser.checkInternetConnection = async () => true;
    engine.browser.open = () => ({ success: true, data: { browser: 'chrome' } });

    const result = await engine.execute('app.open', {
      appName: 'instagram',
      webFallbackUrl: 'https://www.instagram.com/',
      webFallbackBrowser: 'chrome'
    });

    assert.equal(result.success, true);
    assert.equal(result.data.launchMethod, 'chrome-web-app-fallback');
    assert.equal(folderSearched, false);
  });

  it('should not let chat automation overwrite an existing app lock password', async function() {
    const root = tempRoot();
    const manager = new SecurityLockManager({
      app: { dataDir: root },
      logging: { console: false, file: false }
    });
    manager.upsertLock({ type: 'app', target: 'chrome', displayName: 'Chrome', password: '1234' });
    const engine = new AutomationEngine({
      securityLocks: manager,
      app: { dataDir: root },
      logging: { console: false, file: false }
    });

    const result = await engine.execute('security.lock', {
      type: 'app',
      target: 'chrome',
      displayName: 'Chrome',
      password: '9999'
    }, { source: 'chat' });

    assert.equal(result.success, false);
    assert.match(result.error, /already locked/);
    assert.equal(manager.unlock({ type: 'app', target: 'chrome', password: '1234' }).success, true);
    assert.equal(manager.unlock({ type: 'app', target: 'chrome', password: '9999' }).success, false);
  });

  it('should update a folder lock target when the folder path changes through OpenX', function() {
    const root = tempRoot();
    const manager = new SecurityLockManager({
      app: { dataDir: root },
      logging: { console: false, file: false }
    });
    const oldPath = path.join(root, 'Old Folder');
    const newPath = path.join(root, 'New Folder');
    manager.upsertLock({ type: 'folder', target: oldPath, displayName: 'Old Folder', path: oldPath, password: '1234' });

    const updated = manager.updateTarget({
      type: 'folder',
      oldTarget: oldPath,
      newTarget: newPath,
      newPath,
      displayName: 'New Folder'
    });

    assert.equal(updated.success, true);
    assert.equal(manager.findLock({ type: 'folder', target: newPath })?.displayName, 'New Folder');
    assert.equal(manager.findLock({ type: 'folder', target: oldPath }), null);
  });
});
