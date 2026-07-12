const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const {
  DownloadEvents,
  DownloadManager,
  InstallationManager,
  RecoveryManager,
  SelfUpdateManager,
  UpdateEngine,
  UpdateNotificationManager,
  UpdatePresentationService,
  VerificationManager,
  VersionCheckService,
  VersionManager,
  UPDATE_STATES
} = require('../../core/update');
const { SettingsService } = require('../../apps/desktop/settings');

function startDownloadServer(buffer, options = {}) {
  const chunkSize = options.chunkSize || buffer.length;
  const delayMs = options.delayMs || 0;
  let failuresRemaining = Number(options.failures || 0);
  const server = http.createServer((req, res) => {
    if (failuresRemaining > 0) {
      failuresRemaining -= 1;
      res.statusCode = 500;
      res.end('retry');
      return;
    }
    const range = String(req.headers.range || '');
    let offset = 0;
    if (range.startsWith('bytes=')) {
      offset = Math.max(0, Number(range.match(/bytes=(\d+)-/)?.[1] || 0));
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${offset}-${buffer.length - 1}/${buffer.length}`);
    }
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', Math.max(0, buffer.length - offset));
    let cursor = offset;
    const writeNext = () => {
      if (cursor >= buffer.length) {
        res.end();
        return;
      }
      const end = Math.min(buffer.length, cursor + chunkSize);
      res.write(buffer.slice(cursor, end));
      cursor = end;
      if (delayMs > 0) setTimeout(writeNext, delayMs);
      else setImmediate(writeNext);
    };
    writeNext();
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        server,
        url: `http://127.0.0.1:${server.address().port}/asset.bin`
      });
    });
  });
}

function createVerifiedInstallerFixture(tempRoot, options = {}) {
  const downloadsDir = path.join(tempRoot, 'updates', 'downloads');
  const cacheDir = path.join(tempRoot, 'updates', 'cache');
  fs.mkdirSync(downloadsDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });
  const installerPath = path.join(downloadsDir, options.fileName || 'OpenX-6.2.0.exe');
  const buffer = Buffer.from(options.content || 'verified installer fixture');
  fs.writeFileSync(installerPath, buffer);
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  return {
    directories: { rootDir: path.join(tempRoot, 'updates'), downloadsDir, cacheDir },
    installerPath,
    hash,
    verificationResult: {
      success: true,
      status: 'PASSED',
      securityLevel: 'strict',
      data: {
        filePath: installerPath,
        hash: { calculated: hash, expected: hash },
        manifest: { version: options.version || '6.2.0', sha256: hash },
        metadata: {}
      }
    }
  };
}

describe('Update Foundation', function() {
  it('reads the desktop package version without hardcoding it', function() {
    const packagePath = path.join(__dirname, '..', '..', 'package.json');
    const expected = JSON.parse(fs.readFileSync(packagePath, 'utf8')).version;
    const versionManager = new VersionManager({ packagePath });

    const result = versionManager.getCurrentVersion();

    assert.equal(result.success, true);
    assert.equal(result.data.version, expected);
  });

  it('compares semantic versions safely', function() {
    const versionManager = new VersionManager({ metadata: { version: '1.0.0' } });

    assert.equal(versionManager.compareVersions('1.0.1', '1.0.0'), 1);
    assert.equal(versionManager.compareVersions('1.2.0', '1.1.9'), 1);
    assert.equal(versionManager.compareVersions('2.0.0', '1.9.9'), 1);
    assert.equal(versionManager.compareVersions('1.0.0', '1.0.0'), 0);
    assert.equal(versionManager.isNewer('1.0.1', '1.0.0'), true);
    assert.equal(versionManager.isOlder('1.0.0', '1.0.1'), true);
    assert.equal(versionManager.isEqual('1.0.0', '1.0.0'), true);

    const invalid = versionManager.compareVersionResult('bad', '1.0.0');
    assert.equal(invalid.success, false);
    assert.equal(invalid.error.code, 'INVALID_VERSION');
  });

  it('initializes without checking or downloading updates', function() {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-update-foundation-'));
    const packagePath = path.join(tempRoot, 'package.json');
    fs.writeFileSync(packagePath, JSON.stringify({ version: '6.0.1' }));
    const engine = new UpdateEngine({
      config: { app: { dataDir: tempRoot }, update: { enabled: true } },
      packagePath,
      logger: { info() {}, debug() {}, warn() {}, error() {} }
    });

    try {
      const result = engine.initialize();
      const status = engine.getStatus();
      const diagnostics = engine.getDiagnostics();

      assert.equal(result.success, true);
      assert.equal(engine.isInitialized(), true);
      assert.equal(engine.isRunning(), false);
      assert.equal(engine.getCurrentState(), UPDATE_STATES.READY);
      assert.equal(status.data.version, '6.0.1');
      assert.equal(status.data.versionCheck.state, 'UNKNOWN');
      assert.deepEqual(status.data.history, []);
      assert.deepEqual(status.data.providers, []);
      assert.equal(fs.existsSync(path.join(tempRoot, 'updates')), true);
      assert.equal(fs.existsSync(path.join(tempRoot, 'updates', 'downloads')), true);
      assert.equal(fs.existsSync(path.join(tempRoot, 'updates', 'cache')), true);
      assert.equal(diagnostics.success, true);
      assert.equal(diagnostics.data.health.ok, true);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('builds a shared update presentation model without starting downloads or installation', function() {
    const service = new UpdatePresentationService();
    const presentation = service.build({
      state: 'RUNNING',
      version: '6.0.1',
      configuration: { channel: 'stable' },
      versionCheck: {
        state: 'READY',
        updateAvailable: true,
        currentVersion: '6.0.1',
        latestVersion: '6.1.0',
        channel: 'stable',
        releaseNotes: '- Faster startup\n- Fixed update UI'
      },
      updateNotifications: {},
      downloads: { active: [], queued: [], tasks: [], history: [] },
      verification: { state: 'READY' }
    });

    assert.equal(presentation.model.state, 'UPDATE_AVAILABLE');
    assert.equal(presentation.model.version.currentVersion, '6.0.1');
    assert.equal(presentation.model.version.latestVersion, '6.1.0');
    assert.equal(presentation.card.intent, 'update.presentation');
    assert.equal(presentation.model.actions.find(action => action.id === 'download').enabled, false);
    assert.equal(presentation.model.actions.find(action => action.id === 'selfUpdate').enabled, false);
    assert.equal(presentation.model.actions.find(action => action.id === 'install').enabled, false);
  });

  it('exposes update presentation actions and rejects install without passed verification', async function() {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-update-presentation-'));
    const packagePath = path.join(tempRoot, 'package.json');
    fs.writeFileSync(packagePath, JSON.stringify({ version: '6.0.1' }));
    const engine = new UpdateEngine({
      config: { app: { dataDir: tempRoot }, update: { enabled: true } },
      packagePath,
      logger: { info() {}, debug() {}, warn() {}, error() {} }
    });

    try {
      engine.initialize();
      const presentation = engine.getPresentation({ source: 'settings' });
      const notes = engine.getReleaseNotes();
      const actions = engine.getActions();
      const install = await engine.executePresentationAction('install', { source: 'test' });

      assert.equal(presentation.success, true);
      assert.equal(presentation.data.model.version.currentVersion, '6.0.1');
      assert.equal(notes.success, true);
      assert.equal(actions.success, true);
      assert.equal(actions.data.some(action => action.id === 'check'), true);
      assert.equal(install.success, true);
      assert.equal(install.data.result.success, false);
      assert.match(install.data.result.error.message, /verification/i);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('installs only a verified installer after explicit confirmation', async function() {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-install-confirmed-'));
    const fixture = createVerifiedInstallerFixture(tempRoot);
    const events = [];
    const saves = [];
    const shutdowns = [];
    let launched = null;
    const manager = new InstallationManager({
      configuration: { enabled: true, requireConfirmation: false },
      directories: fixture.directories,
      currentVersionProvider: () => '6.0.1',
      verificationProvider: () => fixture.verificationResult,
      confirm: async () => ({ confirmed: true }),
      saveHandlers: [async context => saves.push(context.session.sessionId)],
      shutdownHandlers: [async context => shutdowns.push(context.session.sessionId)],
      launcher: {
        launch(input) {
          launched = input;
          return { pid: 4242, command: input.installerPath, args: [] };
        }
      },
      logger: { info() {}, debug() {}, warn() {}, error() {} }
    });

    try {
      manager.on('update.install.installerLaunched', event => events.push(event));
      manager.initialize(fixture.directories);
      const result = await manager.install();
      const status = manager.getStatus();
      const diagnostics = manager.getDiagnostics();

      assert.equal(result.success, true);
      assert.equal(result.type, 'installation.launched');
      assert.equal(result.data.pid, 4242);
      assert.equal(launched.installerPath, fixture.installerPath);
      assert.deepEqual(launched.args, []);
      assert.equal(saves.length, 1);
      assert.equal(shutdowns.length, 1);
      assert.equal(events.length, 1);
      assert.equal(status.state, 'COMPLETED');
      assert.equal(status.history[0].result, 'LAUNCHED');
      assert.equal(diagnostics.counters.installAttempts, 1);
      assert.equal(diagnostics.counters.successfulInstalls, 1);
      assert.equal(manager.configuration.requireConfirmation, true);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('records cancellation when the user declines installation confirmation', async function() {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-install-cancelled-'));
    const fixture = createVerifiedInstallerFixture(tempRoot);
    let launched = false;
    const manager = new InstallationManager({
      directories: fixture.directories,
      currentVersionProvider: () => '6.0.1',
      verificationProvider: () => fixture.verificationResult,
      confirm: async () => ({ confirmed: false, reason: 'later' }),
      launcher: {
        launch() {
          launched = true;
          return { pid: 1 };
        }
      },
      logger: { info() {}, debug() {}, warn() {}, error() {} }
    });

    try {
      manager.initialize(fixture.directories);
      const result = await manager.install();
      const status = manager.getStatus();
      const diagnostics = manager.getDiagnostics();

      assert.equal(result.success, true);
      assert.equal(result.type, 'installation.cancelled');
      assert.equal(launched, false);
      assert.equal(status.state, 'CANCELLED');
      assert.equal(status.history[0].result, 'CANCELLED');
      assert.equal(diagnostics.counters.cancelledInstalls, 1);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('rejects installers whose verified file changed after verification', async function() {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-install-tampered-'));
    const fixture = createVerifiedInstallerFixture(tempRoot);
    fs.writeFileSync(fixture.installerPath, Buffer.from('tampered installer'));
    const manager = new InstallationManager({
      directories: fixture.directories,
      currentVersionProvider: () => '6.0.1',
      verificationProvider: () => fixture.verificationResult,
      confirm: async () => ({ confirmed: true }),
      launcher: {
        launch() {
          throw new Error('Tampered installer must not launch.');
        }
      },
      logger: { info() {}, debug() {}, warn() {}, error() {} }
    });

    try {
      manager.initialize(fixture.directories);
      const result = await manager.install();

      assert.equal(result.success, false);
      assert.equal(result.error.code, 'INSTALLER_HASH_MISMATCH');
      assert.equal(manager.getStatus().state, 'FAILED');
      assert.equal(manager.getDiagnostics().counters.failedInstalls, 1);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('silently self-updates only a verified installer, preserves state, monitors installer, and restarts OpenX', async function() {
    const EventEmitter = require('events');
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-self-update-'));
    const fixture = createVerifiedInstallerFixture(tempRoot);
    const saved = [];
    const shutdowns = [];
    const restoreCalls = [];
    const launches = [];
    const restarts = [];
    const child = new EventEmitter();
    child.pid = 5151;
    child.kill = () => {};

    const manager = new SelfUpdateManager({
      configuration: {
        monitorTimeoutMs: 30000,
        restartWaitMs: 0
      },
      directories: fixture.directories,
      currentVersionProvider: () => '6.0.1',
      verificationProvider: () => fixture.verificationResult,
      saveHandlers: [async context => saved.push(context.session.sessionId)],
      shutdownHandlers: [async context => shutdowns.push(context.session.sessionId)],
      restoreHandlers: [async context => restoreCalls.push(context.restart.pid)],
      silentInstaller: {
        launch(input) {
          launches.push(input);
          setImmediate(() => child.emit('exit', 0, null));
          return {
            pid: child.pid,
            command: input.installerPath,
            args: ['/S'],
            process: child,
            visibility: {
              mode: 'silent',
              windowsHide: true,
              focused: false,
              minimized: false,
              hidden: true
            }
          };
        }
      },
      restartManager: {
        async restart(options = {}) {
          restarts.push(options);
          return { success: true, pid: 6161, executablePath: 'OpenX.exe', args: [], cwd: tempRoot, durationMs: 1 };
        }
      },
      logger: { info() {}, debug() {}, warn() {}, error() {} }
    });

    try {
      manager.initialize(fixture.directories);
      const result = await manager.selfUpdate({ approved: true, source: 'test' });
      const status = manager.getStatus();
      const diagnostics = manager.getDiagnostics();

      assert.equal(result.success, true);
      assert.equal(result.type, 'selfUpdate.completed');
      assert.equal(launches[0].installerPath, fixture.installerPath);
      assert.equal(result.data.visibility.windowsHide, true);
      assert.equal(result.data.visibility.focused, false);
      assert.equal(saved.length, 1);
      assert.equal(shutdowns.length, 1);
      assert.equal(restarts.length, 1);
      assert.deepEqual(restoreCalls, [6161]);
      assert.equal(status.state, 'COMPLETED');
      assert.equal(status.history[0].result, 'COMPLETED');
      assert.equal(diagnostics.counters.successfulUpdates, 1);
      assert.equal(diagnostics.lastInstalledVersion, '6.2.0');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('rejects self-update when approval is missing or the verified installer is modified', async function() {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-self-update-reject-'));
    const fixture = createVerifiedInstallerFixture(tempRoot);
    let launched = false;
    const manager = new SelfUpdateManager({
      directories: fixture.directories,
      currentVersionProvider: () => '6.0.1',
      verificationProvider: () => fixture.verificationResult,
      silentInstaller: {
        launch() {
          launched = true;
          throw new Error('Unapproved or tampered installer must not launch.');
        }
      },
      restartManager: { async restart() { return { success: true }; } },
      logger: { info() {}, debug() {}, warn() {}, error() {} }
    });

    try {
      manager.initialize(fixture.directories);
      const unapproved = await manager.selfUpdate({ source: 'test' });
      assert.equal(unapproved.success, false);
      assert.equal(unapproved.error.code, 'APPROVAL_REQUIRED');
      fs.writeFileSync(fixture.installerPath, Buffer.from('tampered self update installer'));
      const tampered = await manager.selfUpdate({ approved: true, source: 'test' });
      assert.equal(tampered.success, false);
      assert.equal(tampered.error.code, 'INSTALLER_HASH_MISMATCH');
      assert.equal(launched, false);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('backs up trusted app files and rolls them back without touching user data', async function() {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-recovery-'));
    const appRoot = path.join(tempRoot, 'app');
    const userRoot = path.join(tempRoot, 'user-data');
    const appFile = path.join(appRoot, 'OpenX.exe');
    const requiredFile = path.join(appRoot, 'resources', 'app.asar');
    const userFile = path.join(userRoot, 'settings.json');
    fs.mkdirSync(path.dirname(requiredFile), { recursive: true });
    fs.mkdirSync(userRoot, { recursive: true });
    fs.writeFileSync(appFile, 'previous executable');
    fs.writeFileSync(requiredFile, 'previous app bundle');
    fs.writeFileSync(userFile, '{"theme":"graphite"}');

    const manager = new RecoveryManager({
      directories: {
        rootDir: path.join(tempRoot, 'updates'),
        downloadsDir: path.join(tempRoot, 'updates', 'downloads'),
        cacheDir: path.join(tempRoot, 'updates', 'cache')
      },
      backupPathsProvider: () => [appFile, requiredFile],
      restartManager: { async restart() { return { success: true, skipped: true, durationMs: 0 }; } },
      logger: { info() {}, debug() {}, warn() {}, error() {} }
    });

    try {
      manager.initialize();
      const backup = manager.createBackupForUpdate({
        currentVersion: '6.0.0',
        targetVersion: '6.2.0'
      });
      assert.equal(backup.success, true);
      assert.equal(backup.data.backup.files.length, 2);
      fs.writeFileSync(appFile, 'broken executable');
      fs.writeFileSync(requiredFile, 'broken app bundle');
      fs.writeFileSync(userFile, '{"theme":"white-glass"}');

      const recovered = await manager.handleInstallationFailure(new Error('installer failed'), {
        restartOptions: { skip: true }
      });
      assert.equal(recovered.success, true);
      assert.equal(fs.readFileSync(appFile, 'utf8'), 'previous executable');
      assert.equal(fs.readFileSync(requiredFile, 'utf8'), 'previous app bundle');
      assert.equal(fs.readFileSync(userFile, 'utf8'), '{"theme":"white-glass"}');
      assert.equal(manager.getRollbackHistory()[0].success, true);
      assert.equal(manager.getStatus().state, 'RECOVERY_COMPLETED');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('persists sanitized update settings without URLs', function() {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-update-settings-'));
    const service = new SettingsService({ app: { dataDir: tempRoot } });

    try {
      const saved = service.saveSettings({
        update: {
          enabled: true,
          checkOnStartup: true,
          automaticDownload: true,
          automaticInstall: true,
          allowPrerelease: true,
          channel: 'Beta Channel!',
          retryCount: 99,
          timeoutMs: 42,
          futureProvider: 'future-provider',
          versionCheck: {
            enabled: true,
            checkOnStartup: true,
            startupDelayMs: 25,
            requestTimeoutMs: 2500,
            retryCount: 3,
            retryDelayMs: 500
          },
          presentation: {
            preferredView: 'details!',
            expandedSections: ['version', 'download', '$bad section'],
            notifyAboutUpdates: false,
            showDynamicIsland: false,
            assistantUpdates: false,
            voiceUpdates: false,
            highContrast: true,
            reducedMotion: true,
            windowState: { width: 10000, height: 20, maximized: true }
          },
          installation: {
            enabled: true,
            requireConfirmation: false,
            allowCancellation: true,
            confirmationTimeoutMs: 99999999
          },
          selfUpdate: {
            enabled: true,
            silentInstallationEnabled: true,
            restartAfterInstall: true,
            preserveSession: false,
            futureAutomaticRestart: true,
            monitorTimeoutMs: 10,
            restartWaitMs: 999999,
            silentArgs: {
              exe: ['/S'],
              msi: ['/qn']
            }
          },
          recovery: {
            enabled: true,
            automaticRollback: true,
            startupValidationEnabled: true,
            maxRecoveryAttempts: 99,
            startupTimeoutMs: 100,
            healthTimeoutMs: 999999999,
            loggingEnabled: false,
            diagnosticsEnabled: false
          }
        }
      });
      const runtime = service.buildRuntimeConfig();

      assert.equal(saved.update.enabled, true);
      assert.equal(saved.update.checkOnStartup, true);
      assert.equal(saved.update.automaticDownload, true);
      assert.equal(saved.update.automaticInstall, true);
      assert.equal(saved.update.allowPrerelease, true);
      assert.equal(saved.update.channel, 'betachannel');
      assert.equal(saved.update.retryCount, 10);
      assert.equal(saved.update.timeoutMs, 1000);
      assert.equal(saved.update.futureProvider, 'future-provider');
      assert.equal(saved.update.versionCheck.enabled, true);
      assert.equal(saved.update.versionCheck.checkOnStartup, true);
      assert.equal(saved.update.versionCheck.startupDelayMs, 25);
      assert.equal(saved.update.versionCheck.requestTimeoutMs, 2500);
      assert.equal(saved.update.versionCheck.retryCount, 3);
      assert.equal(saved.update.versionCheck.retryDelayMs, 500);
      assert.equal(saved.update.presentation.preferredView, 'details');
      assert.deepEqual(saved.update.presentation.expandedSections, ['version', 'download', 'badsection']);
      assert.equal(saved.update.presentation.notifyAboutUpdates, false);
      assert.equal(saved.update.presentation.showDynamicIsland, false);
      assert.equal(saved.update.presentation.assistantUpdates, false);
      assert.equal(saved.update.presentation.voiceUpdates, false);
      assert.equal(saved.update.presentation.highContrast, true);
      assert.equal(saved.update.presentation.reducedMotion, true);
      assert.equal(saved.update.presentation.windowState.width, 2400);
      assert.equal(saved.update.presentation.windowState.height, 420);
      assert.equal(saved.update.presentation.windowState.maximized, true);
      assert.equal(saved.update.installation.enabled, true);
      assert.equal(saved.update.installation.requireConfirmation, true);
      assert.equal(saved.update.installation.allowCancellation, true);
      assert.equal(saved.update.installation.confirmationTimeoutMs, 900000);
      assert.equal(saved.update.selfUpdate.enabled, true);
      assert.equal(saved.update.selfUpdate.silentInstallationEnabled, true);
      assert.equal(saved.update.selfUpdate.restartAfterInstall, true);
      assert.equal(saved.update.selfUpdate.preserveSession, false);
      assert.equal(saved.update.selfUpdate.futureAutomaticRestart, true);
      assert.equal(saved.update.selfUpdate.monitorTimeoutMs, 30000);
      assert.equal(saved.update.selfUpdate.restartWaitMs, 30000);
      assert.deepEqual(saved.update.selfUpdate.silentArgs.exe, ['/S']);
      assert.deepEqual(saved.update.selfUpdate.silentArgs.msi, ['/qn']);
      assert.equal(saved.update.recovery.enabled, true);
      assert.equal(saved.update.recovery.automaticRollback, true);
      assert.equal(saved.update.recovery.startupValidationEnabled, true);
      assert.equal(saved.update.recovery.maxRecoveryAttempts, 3);
      assert.equal(saved.update.recovery.startupTimeoutMs, 5000);
      assert.equal(saved.update.recovery.healthTimeoutMs, 300000);
      assert.equal(saved.update.recovery.loggingEnabled, false);
      assert.equal(saved.update.recovery.diagnosticsEnabled, false);
      assert.equal(saved.update.download.enabled, true);
      assert.equal(saved.update.download.backgroundDownloadsEnabled, true);
      assert.equal(saved.update.download.maxRetries, 3);
      assert.equal(saved.update.download.autoResume, true);
      assert.equal(saved.update.verification.enabled, true);
      assert.equal(saved.update.verification.strictSignatureMode, false);
      assert.equal(saved.update.verification.strictManifestMode, true);
      assert.equal(saved.update.verification.strictVersionChecking, true);
      assert.equal(saved.update.verification.strictSecurityPolicy, true);
      assert.equal(Object.prototype.hasOwnProperty.call(saved.update, 'url'), false);
      assert.deepEqual(runtime.update, saved.update);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('checks versions through relay response without download metadata', async function() {
    const packagePath = path.join(os.tmpdir(), `openx-version-${Date.now()}.json`);
    fs.writeFileSync(packagePath, JSON.stringify({ version: '6.0.1' }));
    const relayClient = {
      isConnected: () => true,
      requestVersionCheck: async request => {
        assert.equal(request.application, 'openx');
        assert.equal(request.currentVersion, '6.0.1');
        return {
          status: 'UPDATE_AVAILABLE',
          currentVersion: '6.0.1',
          latestVersion: '6.1.0',
          minimumVersion: '6.0.0',
          releaseDate: new Date().toISOString(),
          mandatory: false,
          channel: 'stable',
          checkedAt: new Date().toISOString(),
          responseTimeMs: 12
        };
      }
    };
    const service = new VersionCheckService({
      packagePath,
      relayClient,
      versionCheck: { enabled: true, retryCount: 0 },
      logger: { info() {}, debug() {}, warn() {}, error() {} }
    });

    try {
      const result = await service.checkNow();
      const status = service.getStatus();
      const diagnostics = service.getDiagnostics();

      assert.equal(result.success, true);
      assert.equal(status.updateAvailable, true);
      assert.equal(status.latestVersion, '6.1.0');
      assert.equal(diagnostics.statistics.successCount, 1);
      assert.equal(JSON.stringify(result.data).includes('downloadUrl'), false);
      assert.equal(JSON.stringify(result.data).includes('installerName'), false);
      assert.equal(JSON.stringify(result.data).includes('sha256'), false);
    } finally {
      fs.rmSync(packagePath, { force: true });
    }
  });

  it('handles pushed update availability notifications without download or install actions', function() {
    const packagePath = path.join(os.tmpdir(), `openx-update-notification-${Date.now()}.json`);
    fs.writeFileSync(packagePath, JSON.stringify({ version: '6.0.1' }));
    const displayed = [];
    const acknowledgements = [];
    const manager = new UpdateNotificationManager({
      packagePath,
      logger: { info() {}, debug() {}, warn() {}, error() {} },
      displayHandler: card => {
        displayed.push(card);
        return true;
      },
      ackSender: (event, stage, status, details) => {
        acknowledgements.push({ eventId: event.eventId, stage, status, details });
        return true;
      }
    });

    try {
      const result = manager.handleEvent({
        type: 'update:available',
        protocolVersion: '1',
        eventId: 'evt-update-1',
        timestamp: new Date().toISOString(),
        latestVersion: '6.1.0',
        minimumVersion: '6.0.0',
        channel: 'stable',
        priority: 'recommended',
        mandatory: false,
        releaseNotes: 'Improved reliability.',
        publishedAt: new Date().toISOString()
      });

      assert.equal(result.success, true);
      assert.equal(result.displayed, true);
      assert.equal(displayed.length, 1);
      assert.equal(displayed[0].response, 'Version 6.1.0 Available');
      assert.deepEqual(displayed[0].data.actions, []);
      assert.deepEqual(displayed[0].data.buttons, []);
      assert.equal(JSON.stringify(displayed[0]).includes('downloadUrl'), false);
      assert.equal(JSON.stringify(displayed[0]).includes('installerName'), false);
      assert.equal(JSON.stringify(displayed[0]).includes('sha256'), false);
      assert.deepEqual(acknowledgements.map(item => item.stage), ['received', 'validated', 'displayed']);

      const rejected = manager.handleEvent({
        type: 'update:available',
        protocolVersion: '1',
        eventId: 'evt-update-2',
        timestamp: new Date().toISOString(),
        latestVersion: '6.1.1',
        downloadUrl: 'https://example.invalid/OpenX.exe'
      });
      assert.equal(rejected.success, false);
      assert.equal(rejected.error.code, 'FORBIDDEN_UPDATE_FIELD');
    } finally {
      fs.rmSync(packagePath, { force: true });
    }
  });

  it('downloads a relay-provided asset into update downloads without executing it', async function() {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-download-success-'));
    const content = Buffer.from('openx-download-content'.repeat(256));
    const { server, url } = await startDownloadServer(content, { chunkSize: 512 });
    const manager = new DownloadManager({
      directories: {
        downloadsDir: path.join(tempRoot, 'updates', 'downloads'),
        cacheDir: path.join(tempRoot, 'updates', 'cache')
      },
      configuration: { maxRetries: 0, timeoutMs: 5000 },
      logger: { info() {}, debug() {}, warn() {}, error() {} }
    });

    try {
      manager.initialize();
      const result = await manager.startDownload({
        assetUrl: url,
        source: 'relay',
        relayProvided: true,
        fileName: 'OpenX-Test.bin',
        assetType: 'installer'
      });

      assert.equal(result.success, true);
      assert.equal(result.data.state, 'COMPLETED');
      assert.equal(fs.readFileSync(result.data.destinationPath).compare(content), 0);
      assert.equal(result.data.destinationPath.includes(path.join('updates', 'downloads')), true);
      assert.equal(fs.existsSync(result.data.partPath), false);
      assert.equal(JSON.stringify(result.data).includes('execute'), false);
      assert.equal(JSON.stringify(result.data).includes('restart'), false);
    } finally {
      await new Promise(resolve => server.close(resolve));
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('rejects desktop-constructed download URLs that are not relay-provided', async function() {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-download-reject-'));
    const manager = new DownloadManager({
      directories: {
        downloadsDir: path.join(tempRoot, 'updates', 'downloads'),
        cacheDir: path.join(tempRoot, 'updates', 'cache')
      },
      logger: { info() {}, debug() {}, warn() {}, error() {} }
    });

    try {
      manager.initialize();
      const result = await manager.startDownload({
        assetUrl: 'https://example.com/OpenX.exe',
        fileName: 'OpenX.exe'
      });
      assert.equal(result.success, false);
      assert.equal(result.error.code, 'SOURCE_NOT_RELAY');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('pauses and resumes a partial download using persisted metadata', async function() {
    this.timeout(10000);
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-download-resume-'));
    const content = Buffer.alloc(128 * 1024, 7);
    const { server, url } = await startDownloadServer(content, { chunkSize: 4096, delayMs: 5 });
    const directories = {
      downloadsDir: path.join(tempRoot, 'updates', 'downloads'),
      cacheDir: path.join(tempRoot, 'updates', 'cache')
    };
    const manager = new DownloadManager({
      directories,
      configuration: { maxRetries: 0, timeoutMs: 10000 },
      logger: { info() {}, debug() {}, warn() {}, error() {} }
    });

    try {
      manager.initialize();
      let taskId = '';
      const progressPromise = new Promise(resolve => {
        manager.once(DownloadEvents.DOWNLOAD_PROGRESS, progress => {
          taskId = progress.id;
          resolve(progress);
        });
      });
      const running = manager.startDownload({
        assetUrl: url,
        source: 'relay',
        relayProvided: true,
        fileName: 'OpenX-Resume.bin'
      });
      await progressPromise;
      const paused = manager.pauseDownload(taskId);
      await running;

      assert.equal(paused.success, true);
      const pausedTask = manager.getTask(taskId);
      assert.equal(pausedTask.state, 'PAUSED');
      assert.equal(fs.existsSync(pausedTask.partPath), true);
      assert.equal(fs.existsSync(pausedTask.metadataPath), true);

      const managerAfterRestart = new DownloadManager({
        directories,
        configuration: { maxRetries: 0, timeoutMs: 10000, autoResume: true },
        logger: { info() {}, debug() {}, warn() {}, error() {} }
      });
      managerAfterRestart.initialize();
      const resumed = await managerAfterRestart.resumeDownload(taskId);

      assert.equal(resumed.success, true);
      assert.equal(resumed.data.state, 'COMPLETED');
      assert.equal(fs.readFileSync(resumed.data.destinationPath).compare(content), 0);
    } finally {
      await new Promise(resolve => server.close(resolve));
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('retries retryable transfer failures and supports cancellation', async function() {
    this.timeout(10000);
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-download-retry-cancel-'));
    const content = Buffer.alloc(32 * 1024, 3);
    const retryServer = await startDownloadServer(content, { failures: 1 });
    const manager = new DownloadManager({
      directories: {
        downloadsDir: path.join(tempRoot, 'updates', 'downloads'),
        cacheDir: path.join(tempRoot, 'updates', 'cache')
      },
      configuration: { maxRetries: 2, retryDelayMs: 100, timeoutMs: 10000 },
      logger: { info() {}, debug() {}, warn() {}, error() {} }
    });

    try {
      manager.initialize();
      const retried = await manager.startDownload({
        assetUrl: retryServer.url,
        source: 'relay',
        relayProvided: true,
        fileName: 'OpenX-Retry.bin'
      });
      assert.equal(retried.success, true);
      assert.equal(retried.data.retryCount, 1);

      const cancelServer = await startDownloadServer(Buffer.alloc(128 * 1024, 5), { chunkSize: 4096, delayMs: 10 });
      try {
        let cancelTaskId = '';
        const progress = new Promise(resolve => {
          manager.once(DownloadEvents.DOWNLOAD_PROGRESS, payload => {
            cancelTaskId = payload.id;
            resolve();
          });
        });
        const running = manager.startDownload({
          assetUrl: cancelServer.url,
          source: 'relay',
          relayProvided: true,
          fileName: 'OpenX-Cancel.bin'
        });
        await progress;
        const cancelled = manager.cancelDownload(cancelTaskId);
        const result = await running;
        assert.equal(cancelled.success, true);
        assert.equal(result.data.state, 'CANCELLED');
      } finally {
        await new Promise(resolve => cancelServer.server.close(resolve));
      }
    } finally {
      await new Promise(resolve => retryServer.server.close(resolve));
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('verifies a downloaded package through the ordered integrity pipeline', async function() {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-verification-pass-'));
    const cacheDir = path.join(tempRoot, 'updates', 'cache');
    const downloadsDir = path.join(tempRoot, 'updates', 'downloads');
    fs.mkdirSync(downloadsDir, { recursive: true });
    const filePath = path.join(downloadsDir, 'OpenX-6.1.0.bin');
    const content = Buffer.from('verified package content');
    fs.writeFileSync(filePath, content);
    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    const manager = new VerificationManager({
      directories: { cacheDir, downloadsDir },
      configuration: { strictSignatureMode: false },
      versionManager: new VersionManager({ metadata: { version: '6.0.1' } }),
      logger: { info() {}, debug() {}, warn() {}, error() {} }
    });

    try {
      manager.initialize();
      const result = await manager.verify({
        filePath,
        manifest: {
          version: '6.1.0',
          size: content.length,
          sha256,
          architecture: 'any',
          platform: process.platform,
          channel: 'stable',
          releaseStatus: 'published'
        }
      });

      assert.equal(result.success, true);
      assert.deepEqual(result.checks.map(check => check.name), [
        'file',
        'readable',
        'size',
        'sha256',
        'signature',
        'metadata',
        'version',
        'manifest',
        'policy'
      ]);
      assert.equal(result.data.hash.calculated, sha256);
      assert.equal(manager.getStatus().state, 'PASSED');
      assert.equal(manager.getDiagnostics().successCount, 1);
      assert.equal(manager.getStatus().history.length, 1);
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('rejects packages when SHA256 or strict signature verification fails', async function() {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-verification-fail-'));
    const cacheDir = path.join(tempRoot, 'updates', 'cache');
    const downloadsDir = path.join(tempRoot, 'updates', 'downloads');
    fs.mkdirSync(downloadsDir, { recursive: true });
    const filePath = path.join(downloadsDir, 'OpenX-6.1.0.bin');
    const content = Buffer.from('tampered package content');
    fs.writeFileSync(filePath, content);
    const logger = { info() {}, debug() {}, warn() {}, error() {} };

    try {
      const hashManager = new VerificationManager({
        directories: { cacheDir, downloadsDir },
        versionManager: new VersionManager({ metadata: { version: '6.0.1' } }),
        logger
      });
      hashManager.initialize();
      const badHash = await hashManager.verify({
        filePath,
        manifest: {
          version: '6.1.0',
          size: content.length,
          sha256: '0'.repeat(64),
          architecture: 'any',
          platform: process.platform,
          channel: 'stable',
          releaseStatus: 'published'
        }
      });
      assert.equal(badHash.success, false);
      assert.equal(badHash.errors[0].code, 'SHA256_MISMATCH');

      const strictSignatureManager = new VerificationManager({
        directories: { cacheDir, downloadsDir },
        configuration: { strictSignatureMode: true },
        versionManager: new VersionManager({ metadata: { version: '6.0.1' } }),
        logger
      });
      strictSignatureManager.initialize();
      const strictSignature = await strictSignatureManager.verify({
        filePath,
        manifest: {
          version: '6.1.0',
          size: content.length,
          sha256: crypto.createHash('sha256').update(content).digest('hex'),
          architecture: 'any',
          platform: process.platform,
          channel: 'stable',
          releaseStatus: 'published'
        }
      });
      assert.equal(strictSignature.success, false);
      assert.equal(strictSignature.errors[0].code, 'SIGNATURE_INVALID');
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('exposes diagnostic and version-check update IPC channels only', function() {
    const root = path.join(__dirname, '..', '..');
    const main = fs.readFileSync(path.join(root, 'apps', 'desktop', 'electron', 'main.js'), 'utf8');
    const security = fs.readFileSync(path.join(root, 'apps', 'desktop', 'electron', 'security.js'), 'utf8');
    const preload = fs.readFileSync(path.join(root, 'apps', 'desktop', 'preload.js'), 'utf8');

    assert.match(main, /'update:status'/);
    assert.match(main, /'update:version'/);
    assert.match(main, /'update:diagnostics'/);
    assert.match(main, /'update:checkVersion'/);
    assert.match(main, /'update:getVersionStatus'/);
    assert.match(main, /'update:getVersionDiagnostics'/);
    assert.match(main, /function getUpdateEngine\(\)/);
    assert.match(main, /registerIpcHandler\('update:status'/);
    assert.match(main, /registerIpcHandler\('update:version'/);
    assert.match(main, /registerIpcHandler\('update:diagnostics'/);
    assert.match(main, /registerIpcHandler\('update:checkVersion'/);
    assert.match(main, /registerIpcHandler\('update:getVersionStatus'/);
    assert.match(main, /registerIpcHandler\('update:getVersionDiagnostics'/);
    assert.match(main, /registerIpcHandler\('update:download:start'/);
    assert.match(main, /registerIpcHandler\('update:download:pause'/);
    assert.match(main, /registerIpcHandler\('update:download:resume'/);
    assert.match(main, /registerIpcHandler\('update:download:cancel'/);
    assert.match(main, /registerIpcHandler\('update:download:status'/);
    assert.match(main, /registerIpcHandler\('update:download:diagnostics'/);
    assert.match(main, /registerIpcHandler\('update:verify'/);
    assert.match(main, /registerIpcHandler\('update:verification:status'/);
    assert.match(main, /registerIpcHandler\('update:verification:diagnostics'/);
    assert.match(main, /registerIpcHandler\('update:selfUpdate'/);
    assert.match(main, /registerIpcHandler\('update:selfUpdateStatus'/);
    assert.match(main, /registerIpcHandler\('update:selfUpdateDiagnostics'/);
    assert.match(main, /registerIpcHandler\('update:recoveryStatus'/);
    assert.match(main, /registerIpcHandler\('update:recoveryDiagnostics'/);
    assert.match(main, /registerIpcHandler\('update:rollbackHistory'/);
    assert.match(security, /'update:status': validateEmpty/);
    assert.match(security, /'update:version': validateEmpty/);
    assert.match(security, /'update:diagnostics': validateEmpty/);
    assert.match(security, /'update:checkVersion': validateEmpty/);
    assert.match(security, /'update:getVersionStatus': validateEmpty/);
    assert.match(security, /'update:getVersionDiagnostics': validateEmpty/);
    assert.match(security, /'update:download:start': validateDownloadStart/);
    assert.match(security, /'update:download:pause': validateDownloadTask/);
    assert.match(security, /'update:download:resume': validateDownloadTask/);
    assert.match(security, /'update:download:cancel': validateDownloadTask/);
    assert.match(security, /'update:download:status': validateDownloadStatus/);
    assert.match(security, /'update:download:diagnostics': validateEmpty/);
    assert.match(security, /'update:verify': validateUpdateVerify/);
    assert.match(security, /'update:verification:status': validateEmpty/);
    assert.match(security, /'update:verification:diagnostics': validateEmpty/);
    assert.match(security, /'update:install': validateUpdateInstall/);
    assert.match(security, /'update:cancelInstallation': validateUpdateCancelInstallation/);
    assert.match(security, /'update:getInstallationStatus': validateEmpty/);
    assert.match(security, /'update:getInstallationDiagnostics': validateEmpty/);
    assert.match(security, /'update:selfUpdate': validateUpdateSelfUpdate/);
    assert.match(security, /'update:selfUpdateStatus': validateEmpty/);
    assert.match(security, /'update:selfUpdateDiagnostics': validateEmpty/);
    assert.match(security, /'update:recoveryStatus': validateEmpty/);
    assert.match(security, /'update:recoveryDiagnostics': validateEmpty/);
    assert.match(security, /'update:rollbackHistory': validateEmpty/);
    assert.match(preload, /getUpdateStatus:/);
    assert.match(preload, /getUpdateVersion:/);
    assert.match(preload, /getUpdateDiagnostics:/);
    assert.match(preload, /checkUpdateVersion:/);
    assert.match(preload, /getUpdateVersionStatus:/);
    assert.match(preload, /getUpdateVersionDiagnostics:/);
    assert.match(preload, /startUpdateDownload:/);
    assert.match(preload, /pauseUpdateDownload:/);
    assert.match(preload, /resumeUpdateDownload:/);
    assert.match(preload, /cancelUpdateDownload:/);
    assert.match(preload, /getUpdateDownloadStatus:/);
    assert.match(preload, /getUpdateDownloadDiagnostics:/);
    assert.match(preload, /verifyUpdatePackage:/);
    assert.match(preload, /getUpdateVerificationStatus:/);
    assert.match(preload, /getUpdateVerificationDiagnostics:/);
    assert.match(preload, /installUpdate:/);
    assert.match(preload, /cancelUpdateInstallation:/);
    assert.match(preload, /getUpdateInstallationStatus:/);
    assert.match(preload, /getUpdateInstallationDiagnostics:/);
    assert.match(preload, /selfUpdate:/);
    assert.match(preload, /getSelfUpdateStatus:/);
    assert.match(preload, /getSelfUpdateDiagnostics:/);
    assert.match(preload, /getUpdateRecoveryStatus:/);
    assert.match(preload, /getUpdateRecoveryDiagnostics:/);
    assert.match(preload, /getUpdateRollbackHistory:/);
    assert.doesNotMatch(main, /electron-updater|autoUpdater|downloadUpdate|checkForUpdates/);
    assert.doesNotMatch(main, /checkVersionOnStartup\(\{\s*source:\s*'desktop-startup'/);
  });
});
