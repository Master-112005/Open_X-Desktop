const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, globalShortcut, session, screen, powerMonitor, safeStorage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const WebSocket = require('ws');

const BASE_CONFIG = require('../../../config');
const Assistant = require('../../../core/assistant/index');
const { SettingsService } = require('../settings');
const { AssistantEventBus, EVENTS, Logger } = require('../../../core/assistant/Data');
const {
  ensureDataRoot,
  legacyQuarantinePath,
  migrateLegacyData,
  moveDirectoryIntoManagedData,
  readSecureJsonFile: readJsonFile,
  writeSecureJsonAtomic: writeJsonAtomic
} = require('../../../core/assistant/Data');
const { CloudCommandManager, CloudConnectionManager, CloudFileTransferManager, CloudLogger, CloudPairingManager } = require('../../../core/cloud');
const { HomeOnboardingManager, HomeLanDiscoveryTransport, HomeDeviceStore, resolveHomeOwnerId, HomeCommandClient } = require('../../../core/home-automation');
const CrashRecoveryPolicy = require('./crash-recovery');
const OpenXSecurityLock = require('../security-lock');
const { ModelLoader } = require('../voice/stt/ModelLoader');
const {
  IPC_VALIDATORS,
  assertTrustedIpcSender,
  createSecureWebPreferences,
  getIpcSenderUrl,
  isPlainObject,
  isTrustedRendererUrl
} = require('./security');
const { selectHomeBluetoothDevice } = require('./home-bluetooth-selection');

const RENDERER_ROOT = path.resolve(__dirname, '..', 'renderer');
const PRELOAD_PATH = path.join(__dirname, '..', 'preload.js');
const MAX_RENDERER_RESTARTS = 3;
const RENDERER_RESTART_WINDOW_MS = 60 * 1000;
const RENDERER_RESTART_DELAY_MS = 1000;
const MAX_RENDERER_RECOVERY_DELAY_MS = 5000;
const UNRESPONSIVE_RELOAD_DELAY_MS = 15 * 1000;
const FATAL_CLEANUP_TIMEOUT_MS = 3000;
const STABLE_RUNTIME_MS = 2 * 60 * 1000;
const ERR_ABORTED = -3;
const RENDERER_RECOVERABLE_REASONS = new Set([
  'abnormal-exit',
  'crashed',
  'killed',
  'oom',
  'launch-failed',
  'integrity-failure'
]);
const TEMP_CLEANUP_STARTUP_DELAY_MS = 12 * 1000;
const TEMP_CLEANUP_MAX_SCAN_ENTRIES = 1000;
const TEMP_CLEANUP_MAX_DELETE_ENTRIES = 128;
const TEMP_CLEANUP_CONCURRENCY = 4;
const VOICE_WINDOW_WIDTH = 460;
const VOICE_WINDOW_HEIGHT = 144;
const ISLAND_WINDOW_WIDTH = 460;
const ISLAND_WINDOW_HEIGHT = 144;
const VOICE_MODEL_PRELOAD_DELAY_MS = 90 * 1000;
const ISLAND_DEFAULT_SNOOZE_MINUTES = 5;

const ELECTRON_PROFILE_DIR = BASE_CONFIG.app.dataPaths.electronProfileDir;
const LEGACY_ELECTRON_PROFILE_DIRS = Object.freeze([
  path.join(app.getPath('appData'), 'OpenX-Development'),
  path.join(app.getPath('appData'), 'OpenX')
]);
const ELECTRON_PROFILE_STORAGE_ITEMS = Object.freeze([
  'Local Storage',
  'IndexedDB',
  'Session Storage',
  'Preferences'
]);

function copyProfileItemIfMissing(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath) || fs.existsSync(targetPath)) return;
  const stats = fs.statSync(sourcePath);
  if (stats.isDirectory()) {
    fs.mkdirSync(targetPath, { recursive: true });
    for (const child of fs.readdirSync(sourcePath)) {
      copyProfileItemIfMissing(path.join(sourcePath, child), path.join(targetPath, child));
    }
    return;
  }
  if (stats.isFile()) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function migrateElectronProfileStorage(targetProfileDir) {
  for (const legacyProfileDir of LEGACY_ELECTRON_PROFILE_DIRS) {
    const resolvedLegacy = path.resolve(legacyProfileDir);
    const resolvedTarget = path.resolve(targetProfileDir);
    if (resolvedLegacy === resolvedTarget || !fs.existsSync(resolvedLegacy)) continue;
    for (const itemName of ELECTRON_PROFILE_STORAGE_ITEMS) {
      try {
        copyProfileItemIfMissing(path.join(resolvedLegacy, itemName), path.join(resolvedTarget, itemName));
      } catch (error) {
        console.warn(`OpenX profile migration skipped ${itemName}: ${error.message}`);
      }
    }
    const quarantine = moveDirectoryIntoManagedData(
      resolvedLegacy,
      legacyQuarantinePath(BASE_CONFIG.app.dataPaths, `electron-profile-${path.basename(resolvedLegacy)}`)
    );
    if (!quarantine.moved && !['missing-or-same-path', 'target-inside-source'].includes(quarantine.reason)) {
      console.warn(`OpenX could not move legacy Electron profile into OpenX_Data: ${quarantine.error || quarantine.reason}`);
    }
  }
}

function configureManagedElectronProfile() {
  try {
    fs.mkdirSync(ELECTRON_PROFILE_DIR, { recursive: true });
    migrateElectronProfileStorage(ELECTRON_PROFILE_DIR);
    app.setPath('userData', ELECTRON_PROFILE_DIR);
  } catch (error) {
    console.warn(`OpenX could not use managed Electron profile storage: ${error.message}`);
  }
}

configureManagedElectronProfile();

async function cleanupOpenXTempArtifacts(options = {}) {
  const tempRoot = path.resolve(os.tmpdir());
  const maxAgeMs = Number.isFinite(options.maxAgeMs) ? options.maxAgeMs : 24 * 60 * 60 * 1000;
  const maxScanEntries = Number.isFinite(options.maxScanEntries)
    ? Math.max(1, Math.round(options.maxScanEntries))
    : TEMP_CLEANUP_MAX_SCAN_ENTRIES;
  const maxDeleteEntries = Number.isFinite(options.maxDeleteEntries)
    ? Math.max(1, Math.round(options.maxDeleteEntries))
    : TEMP_CLEANUP_MAX_DELETE_ENTRIES;
  const concurrency = Number.isFinite(options.concurrency)
    ? Math.max(1, Math.min(8, Math.round(options.concurrency)))
    : TEMP_CLEANUP_CONCURRENCY;
  const cutoff = Date.now() - maxAgeMs;
  const targets = [];
  let scanned = 0;
  let limited = false;

  for await (const entry of await fs.promises.opendir(tempRoot)) {
    scanned += 1;
    if (scanned > maxScanEntries) {
      limited = true;
      break;
    }
    if (!/^openx-/i.test(entry.name)) continue;
    const target = path.resolve(tempRoot, entry.name);
    if (path.dirname(target) !== tempRoot) continue;
    try {
      const stats = await fs.promises.stat(target);
      if (stats.mtimeMs <= cutoff) targets.push(target);
      if (targets.length >= maxDeleteEntries) {
        limited = true;
        break;
      }
    } catch (_) {}
  }

  let removed = 0;
  for (let index = 0; index < targets.length; index += concurrency) {
    const batch = targets.slice(index, index + concurrency);
    const results = await Promise.allSettled(
      batch.map(target => fs.promises.rm(target, { recursive: true, force: true }))
    );
    removed += results.filter(result => result.status === 'fulfilled').length;
  }

  return { scanned, queued: targets.length, removed, retained: targets.length - removed, limited, tempRoot };
}

try {
  app.commandLine.appendSwitch('disable-background-networking');
  app.commandLine.appendSwitch('disable-component-update');
  app.commandLine.appendSwitch('disable-client-side-phishing-detection');
  app.commandLine.appendSwitch('disable-domain-reliability');
  app.commandLine.appendSwitch('no-default-browser-check');
  app.commandLine.appendSwitch('disable-sync');
  app.commandLine.appendSwitch('metrics-recording-only');
  app.commandLine.appendSwitch('no-pings');
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
  app.commandLine.appendSwitch(
    'disable-features',
    [
      'WinRetrieveSuggestionsOnlyOnDemand',
      'AutofillServerCommunication',
      'CertificateTransparencyComponentUpdater',
      'DnsOverHttps',
      'InterestFeedContentSuggestions',
      'MediaRouter',
      'NetworkTimeServiceQuerying',
      'OptimizationHints',
      'UseDnsHttpsSvcb'
    ].join(',')
  );
} catch (_) {}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  console.log('OpenX is already running. Focusing the existing instance.');
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (chatWindow && !chatWindow.isDestroyed()) {
    revealChatWindow();
  } else {
    createChatWindow();
  }
});

class ChildProcessRegistry {
  constructor() {
    this.children = new Set();
  }

  register(child) {
    if (!child || !child.pid) return;
    this.children.add(child);
  }

  unregister(child) {
    this.children.delete(child);
  }

  killAll() {
    if (process.platform !== 'win32') return;
    for (const child of this.children) {
      try {
        if (child && child.pid) {
          const { spawnSync } = require('child_process');
          spawnSync('taskkill', ['/pid', String(child.pid), '/f', '/t'], { stdio: 'ignore' });
        }
      } catch (_) {}
    }
    this.children.clear();
  }
}

const childProcessRegistry = new ChildProcessRegistry();

const mainLogger = new Logger(BASE_CONFIG.logging);
let openXTempCleanupTimer = null;

function scheduleOpenXTempCleanup(reason = 'startup', delayMs = TEMP_CLEANUP_STARTUP_DELAY_MS) {
  if (openXTempCleanupTimer || cleanupFinished || cleanupPromise) return;
  openXTempCleanupTimer = setTimeout(() => {
    openXTempCleanupTimer = null;
    cleanupOpenXTempArtifacts()
      .then(result => {
        if (result.removed > 0 || result.limited) {
          mainLogger.info('OpenX stale temp cleanup completed', { ...result, reason });
        }
      })
      .catch(error => mainLogger.warn('OpenX stale temp cleanup failed', { error: error.message, reason }));
  }, Math.max(1000, Number(delayMs) || TEMP_CLEANUP_STARTUP_DELAY_MS));
  openXTempCleanupTimer.unref?.();
}
const crashRecoveryPolicy = new CrashRecoveryPolicy({
  statePath: path.join(BASE_CONFIG.app.dataPaths.runtimeDir, 'crash-recovery.json'),
  maxRestarts: 3,
  windowMs: 5 * 60 * 1000
});

let chatWindow = null;
let voiceWindow = null;
let islandWindow = null;
let islandReady = false;
let pendingVoiceActivation = null;
let pendingIslandItems = [];
let timerWidgetWindow = null;
let timerWidgetMode = null;
let plannerWindow = null;
let tray = null;
let assistant = null;
let powerRecoveryHandlersRegistered = false;
let settingsService = null;
let runtimeConfig = null;
let eventBus = null;
let registeredChatShortcuts = [];
let registeredVoiceShortcuts = [];
let voiceModelLoader = null;
let voiceWarmupTimer = null;
let ipcRegistered = false;
let cleanupFinished = false;
let cleanupPromise = null;
let fatalErrorHandling = false;
let signalHandling = false;
let stableRuntimeHandle = null;
let chatLoweredForPlanner = false;
let securityLockService = null;
let cloudConnectionManager = null;
let cloudPairingManager = null;
let cloudCommandManager = null;
let cloudFileTransferManager = null;
let homeOnboardingManager = null;
let homeCommandClient = null;
let pendingHomeBluetoothSelection = null;
let lastHomeBluetoothSelection = null;
const HOME_BLUETOOTH_SCAN_TIMEOUT_MS = 35000;
let cloudProfileSyncRegistered = false;
let cloudModesSyncRegistered = false;
const rendererCrashHistory = new Map();
const recoveryTimeouts = new Set();
const unresponsiveTimeouts = new Map();
const IPC_CHANNELS = [
  'command:process',
  'command:confirm',
  'assistant:status',
  'browser:openExternal',
  'window:openChat',
  'window:hideChat',
  'window:openVoice',
  'voice:close',
  'voice:getActivation',
  'voice:getSettings',
  'voice:updateSettings',
  'voice:transcribe',
  'window:openSettings',
  'window:openPlanner',
  'window:closePlanner',
  'config:get',
  'settings:get',
  'assistantChatHistory:get',
  'assistantChatHistory:getSync',
  'assistantChatHistory:save',
  'assistantChatHistory:saveSync',
  'assistantChatHistory:clear',
  'remote:listTargets',
  'remote:control',
  'uiState:get',
  'uiState:save',
  'security:status',
  'security:verifyAccess',
  'security:setPassword',
  'cloud:status',
  'cloud:connect',
  'cloud:disconnect',
  'cloud:pairingQR:create',
  'cloud:pairing:status',
  'cloud:pairing:approve',
  'cloud:pairing:reject',
  'cloud:devices:list',
  'cloud:device:rename',
  'cloud:device:remove',
  'settings:save',
  'settings:reset',
  'schedule:alertAction',
  'island:stop',
  'island:snooze',
  'island:idle',
  'cloud:fileTransferAction',
  'schedule:getSnapshot',
  'timerWidget:getState',
  'timerWidget:close',
  'timerWidget:stopStopwatch',
  'timerWidget:resumeStopwatch',
  'timerWidget:resetStopwatch',
  'planner:getEntries',
  'planner:addEntry',
  'planner:deleteEntry',
  'app:quit'
];

function ensureDataDir() {
  const paths = ensureDataRoot(BASE_CONFIG);
  if (BASE_CONFIG.app?.migrateLegacyData) {
    migrateLegacyData(BASE_CONFIG);
  }
  migrateAccidentalAssistantChatHistory();
  if (!fs.existsSync(paths.logsDir)) {
    fs.mkdirSync(paths.logsDir, { recursive: true });
  }
}

function disableSpellChecker() {
  try {
    session.defaultSession?.setSpellCheckerEnabled?.(false);
  } catch (error) {
    mainLogger.warn('Failed to disable spell checker', { error: error.message });
  }
}

function isChatRendererUrl(url) {
  if (!isTrustedRendererUrl(url, RENDERER_ROOT)) return false;
  try {
    const { fileURLToPath } = require('url');
    return path.resolve(fileURLToPath(url)) === path.resolve(path.join(RENDERER_ROOT, 'chat', 'index.html'));
  } catch (_) {
    return false;
  }
}

function isVoiceRendererUrl(url) {
  if (!isTrustedRendererUrl(url, RENDERER_ROOT)) return false;
  try {
    const { fileURLToPath } = require('url');
    return path.resolve(fileURLToPath(url)) === path.resolve(path.join(RENDERER_ROOT, 'voice', 'index.html'));
  } catch (_) {
    return false;
  }
}

function canGrantHomeBluetoothPermission(webContents, permission, candidateUrl = '') {
  const normalizedPermission = String(permission || '').toLowerCase();
  const bluetoothPermissions = new Set([
    'bluetooth',
    'bluetoothscanning',
    'bluetooth-serial',
    'bluetoothserial'
  ]);
  if (!bluetoothPermissions.has(normalizedPermission)) return false;
  const contentsUrl = webContents?.getURL?.() || '';
  return isChatRendererUrl(candidateUrl) || isChatRendererUrl(contentsUrl);
}

function canGrantVoiceMediaPermission(webContents, permission, candidateUrl = '') {
  const normalizedPermission = String(permission || '').toLowerCase();
  if (!['media', 'audio', 'microphone'].includes(normalizedPermission)) return false;
  const contentsUrl = webContents?.getURL?.() || '';
  return isVoiceRendererUrl(candidateUrl) || isVoiceRendererUrl(contentsUrl);
}

function clearPendingHomeBluetoothSelection() {
  if (!pendingHomeBluetoothSelection) return;
  clearTimeout(pendingHomeBluetoothSelection.timeout);
  pendingHomeBluetoothSelection = null;
}

function handleHomeBluetoothDeviceSelection(event, deviceList, callback) {
  event.preventDefault();
  // Electron re-invokes this handler with a growing deviceList every time the
  // native BLE scan sees a new advertisement, not just once at the end of the
  // scan. Cancelling immediately whenever the OpenX device isn't in the list
  // yet aborts the scan before the ESP32's advertisement has a chance to
  // arrive, so a "no match yet" result must keep the scan alive instead.
  const devices = Array.isArray(deviceList) ? deviceList : [];
  const candidates = devices.slice(0, 8).map(device => ({
    deviceName: device.deviceName || device.name || 'unknown',
    deviceId: device.deviceId ? `${String(device.deviceId).slice(0, 8)}...` : ''
  }));
  mainLogger.info('[HOME] Bluetooth provisioning candidates found', {
    candidateCount: devices.length,
    candidates
  });
  const selected = selectHomeBluetoothDevice(devices);
  if (selected?.deviceId) {
    lastHomeBluetoothSelection = {
      bluetoothDeviceId: String(selected.deviceId || ''),
      deviceName: String(selected.deviceName || selected.name || 'OpenX Home Device'),
      serviceUuids: Array.isArray(selected.serviceUuids) ? selected.serviceUuids.slice(0, 16) : [],
      uuids: Array.isArray(selected.uuids) ? selected.uuids.slice(0, 16) : [],
      selectedAt: new Date().toISOString()
    };
    mainLogger.info('[HOME] Selected Bluetooth Home Device for provisioning', {
      deviceName: selected.deviceName || selected.name || 'unknown'
    });
    clearPendingHomeBluetoothSelection();
    callback(selected.deviceId);
    return;
  }
  clearPendingHomeBluetoothSelection();
  const timeout = setTimeout(() => {
    mainLogger.warn('[HOME] No OpenX Bluetooth Home Device was found before the scan timeout', {
      candidateCount: devices.length
    });
    pendingHomeBluetoothSelection = null;
    callback('');
  }, HOME_BLUETOOTH_SCAN_TIMEOUT_MS);
  pendingHomeBluetoothSelection = { callback, timeout };
}

function configureSessionSecurity() {
  try {
    const defaultSession = session.defaultSession;
    defaultSession?.setPermissionRequestHandler?.((webContents, permission, callback, details) => {
      const requestingUrl = details?.requestingUrl || webContents?.getURL?.() || '';
      if (canGrantHomeBluetoothPermission(webContents, permission, requestingUrl)) {
        mainLogger.info('[HOME] Allowed Home Device Bluetooth permission', { permission, requestingUrl });
        callback(true);
        return;
      }
      if (canGrantVoiceMediaPermission(webContents, permission, requestingUrl)) {
        mainLogger.info('[VOICE] Allowed microphone permission', { permission, requestingUrl });
        callback(true);
        return;
      }
      mainLogger.warn('Blocked renderer permission request', {
        permission,
        requestingUrl
      });
      callback(false);
    });
    defaultSession?.setPermissionCheckHandler?.((webContents, permission, requestingOrigin) => {
      if (canGrantHomeBluetoothPermission(webContents, permission, requestingOrigin)) {
        return true;
      }
      if (canGrantVoiceMediaPermission(webContents, permission, requestingOrigin)) {
        return true;
      }
      mainLogger.warn('Blocked renderer permission check', { permission, requestingOrigin });
      return false;
    });
    defaultSession?.webRequest?.onBeforeRequest?.({
      urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*']
    }, (details, callback) => {
      if (details.resourceType === 'mainFrame' || details.resourceType === 'subFrame') {
        mainLogger.warn('Blocked renderer network navigation', {
          url: details.url,
          resourceType: details.resourceType
        });
        callback({ cancel: true });
        return;
      }
      callback({});
    });
  } catch (error) {
    mainLogger.warn('Failed to configure session security', { error: error.message });
  }
}

function clearUnresponsiveTimeout(browserWindow) {
  const timeout = unresponsiveTimeouts.get(browserWindow);
  if (!timeout) return;
  clearTimeout(timeout);
  unresponsiveTimeouts.delete(browserWindow);
}

function isRendererExitRecoverable(reason) {
  return RENDERER_RECOVERABLE_REASONS.has(String(reason || ''));
}

function isLoadFailureRecoverable(errorCode, validatedUrl, expectedPath) {
  if (Number(errorCode) === ERR_ABORTED) return false;
  if (!validatedUrl) return false;
  try {
    const { fileURLToPath } = require('url');
    return path.resolve(fileURLToPath(validatedUrl)) === expectedPath;
  } catch (_) {
    return false;
  }
}

function consumeRendererRestartBudget(windowType) {
  const now = Date.now();
  const recent = (rendererCrashHistory.get(windowType) || [])
    .filter(timestamp => now - timestamp < RENDERER_RESTART_WINDOW_MS);
  if (recent.length >= MAX_RENDERER_RESTARTS) {
    rendererCrashHistory.set(windowType, recent);
    return { allowed: false, crashCount: recent.length };
  }
  recent.push(now);
  rendererCrashHistory.set(windowType, recent);
  return { allowed: true, crashCount: recent.length };
}

function recordRendererRecoveryEvent(windowType, metadata = {}) {
  try {
    return crashRecoveryPolicy.recordRendererFailure(Date.now(), {
      windowType,
      component: `renderer:${windowType}`,
      ...metadata
    });
  } catch (error) {
    mainLogger.warn('Failed to persist renderer recovery diagnostics', {
      windowType,
      error: error.message
    });
    return null;
  }
}

function scheduleRendererRecovery(windowType, createWindow, metadata = {}) {
  if (cleanupFinished || cleanupPromise) {
    mainLogger.info('Skipped renderer recovery during shutdown', { windowType });
    return;
  }

  const budget = consumeRendererRestartBudget(windowType);
  if (!budget.allowed) {
    mainLogger.error('Renderer recovery budget exhausted', { windowType });
    recordRendererRecoveryEvent(windowType, {
      ...metadata,
      reason: metadata.reason || 'renderer recovery budget exhausted',
      recoveryAction: 'blocked',
      allowed: false
    });
    return;
  }

  const delayMs = Math.min(
    MAX_RENDERER_RECOVERY_DELAY_MS,
    RENDERER_RESTART_DELAY_MS * Math.max(1, budget.crashCount)
  );
  recordRendererRecoveryEvent(windowType, {
    ...metadata,
    reason: metadata.reason || 'renderer recovery scheduled',
    recoveryAction: 'recreate-window',
    delayMs,
    allowed: true
  });
  const timeout = setTimeout(() => {
    recoveryTimeouts.delete(timeout);
    if (!cleanupFinished && !cleanupPromise) createWindow();
  }, delayMs);
  recoveryTimeouts.add(timeout);
  if (typeof timeout.unref === 'function') timeout.unref();
}

function secureWindow(browserWindow, options) {
  const { windowType, expectedFile, createWindow } = options;
  const expectedPath = path.resolve(expectedFile);

  browserWindow.webContents.setWindowOpenHandler(({ url }) => {
    mainLogger.warn('Blocked renderer popup', { windowType, url });
    return { action: 'deny' };
  });

  browserWindow.webContents.once('did-finish-load', () => {
    mainLogger.info('Renderer loaded', { windowType });
  });

  browserWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedUrl) => {
    mainLogger.error('Renderer failed to load', {
      windowType,
      errorCode,
      errorDescription,
      validatedUrl
    });
    if (createWindow && isLoadFailureRecoverable(errorCode, validatedUrl, expectedPath)) {
      if (!browserWindow.isDestroyed()) browserWindow.destroy();
      scheduleRendererRecovery(`${windowType}:load`, createWindow, {
        reason: errorDescription || 'renderer load failed',
        eventType: 'did-fail-load',
        errorCode: Number(errorCode) || null
      });
    }
  });

  browserWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    mainLogger.error('Renderer preload failed', {
      windowType,
      preloadPath,
      error: error.message
    });
    if (createWindow) {
      if (!browserWindow.isDestroyed()) browserWindow.destroy();
      scheduleRendererRecovery(`${windowType}:preload`, createWindow, {
        reason: error.message,
        eventType: 'preload-error'
      });
    }
  });

  browserWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRendererUrl(url, RENDERER_ROOT)) {
      event.preventDefault();
      mainLogger.warn('Blocked renderer navigation', { windowType, url });
      return;
    }

    try {
      const { fileURLToPath } = require('url');
      if (path.resolve(fileURLToPath(url)) !== expectedPath) {
        event.preventDefault();
        mainLogger.warn('Blocked cross-view renderer navigation', { windowType, url });
      }
    } catch (error) {
      event.preventDefault();
      mainLogger.warn('Blocked malformed renderer navigation', { windowType, error: error.message });
    }
  });

  browserWindow.webContents.on('render-process-gone', (_event, details) => {
    if (cleanupFinished || cleanupPromise || !isRendererExitRecoverable(details.reason)) {
      mainLogger.info('Renderer process exited without recovery', { windowType, details });
      return;
    }

    const error = new Error(`${windowType} renderer exited: ${details.reason}`);
    Logger.writeCrashSync(error, { type: 'renderer', windowType, details }, BASE_CONFIG.logging);
    mainLogger.error('Renderer process exited unexpectedly', { windowType, details });
    if (!browserWindow.isDestroyed()) browserWindow.destroy();
    scheduleRendererRecovery(windowType, createWindow, {
      reason: `renderer exited: ${details.reason}`,
      eventType: 'render-process-gone',
      details
    });
  });

  browserWindow.on('unresponsive', () => {
    mainLogger.warn('Renderer became unresponsive', { windowType });
    if (unresponsiveTimeouts.has(browserWindow)) return;
    const timeout = setTimeout(() => {
      unresponsiveTimeouts.delete(browserWindow);
      if (
        !browserWindow.isDestroyed()
        && !browserWindow.webContents.isDestroyed()
        && browserWindow.webContents.isLoading() === false
      ) {
        const error = new Error(`${windowType} renderer remained unresponsive`);
        Logger.writeCrashSync(error, { type: 'renderer-unresponsive', windowType }, BASE_CONFIG.logging);
        const budget = consumeRendererRestartBudget(`${windowType}:unresponsive`);
        if (!budget.allowed) {
          mainLogger.error('Renderer unresponsive recovery budget exhausted', { windowType });
          recordRendererRecoveryEvent(`${windowType}:unresponsive`, {
            reason: 'renderer remained unresponsive',
            eventType: 'unresponsive',
            recoveryAction: 'blocked',
            allowed: false
          });
          return;
        }
        recordRendererRecoveryEvent(`${windowType}:unresponsive`, {
          reason: 'renderer remained unresponsive',
          eventType: 'unresponsive',
          recoveryAction: 'reloadIgnoringCache',
          allowed: true
        });
        mainLogger.warn('Reloading unresponsive renderer', { windowType });
        browserWindow.webContents.reloadIgnoringCache();
      }
    }, UNRESPONSIVE_RELOAD_DELAY_MS);
    unresponsiveTimeouts.set(browserWindow, timeout);
    if (typeof timeout.unref === 'function') timeout.unref();
  });

  browserWindow.on('responsive', () => {
    clearUnresponsiveTimeout(browserWindow);
  });

  browserWindow.on('closed', () => {
    clearUnresponsiveTimeout(browserWindow);
  });
}

function forwardRendererConsole(browserWindow, windowType) {
  browserWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const metadata = {
      windowType,
      line: Number(line) || null,
      source: sourceId ? path.basename(String(sourceId)) : ''
    };
    if (level >= 3) {
      mainLogger.error(`[${windowType}] ${message}`, metadata);
    } else if (level === 2) {
      mainLogger.warn(`[${windowType}] ${message}`, metadata);
    } else {
      mainLogger.info(`[${windowType}] ${message}`, metadata);
    }
  });
}

function revealChatWindow() {
  if (!chatWindow || chatWindow.isDestroyed()) return false;
  if (chatWindow.isMinimized()) chatWindow.restore();
  chatWindow.setAlwaysOnTop(true);
  chatLoweredForPlanner = false;
  chatWindow.show();
  chatWindow.focus();
  return true;
}

function createChatWindow() {
  if (chatWindow && !chatWindow.isDestroyed()) {
    revealChatWindow();
    return;
  }

  chatWindow = new BrowserWindow({
    width: 400,
    height: 560,
    minWidth: 340,
    minHeight: 460,
    transparent: true,
    frame: false,
    resizable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: true,
    webPreferences: {
      ...createSecureWebPreferences(PRELOAD_PATH),
      enableBlinkFeatures: 'WebBluetooth'
    }
  });

  const chatFile = path.join(RENDERER_ROOT, 'chat', 'index.html');
  secureWindow(chatWindow, {
    windowType: 'chat',
    expectedFile: chatFile,
    createWindow: createChatWindow
  });
  chatWindow.webContents.on('select-bluetooth-device', handleHomeBluetoothDeviceSelection);
  chatWindow.loadFile(chatFile).catch(error => {
    mainLogger.error('Failed to load chat renderer', { error: error.message });
  });

  chatWindow.on('closed', () => {
    chatWindow = null;
    clearPendingHomeBluetoothSelection();
  });

  if (process.argv.includes('--dev')) {
    chatWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function topCenterBounds(width, height, offsetY = 0) {
  const display = screen.getPrimaryDisplay();
  const area = display?.workArea || { x: 0, y: 0, width: 1280, height: 720 };
  return {
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + offsetY),
    width,
    height
  };
}

function getVoiceModelLoader() {
  if (!voiceModelLoader) {
    voiceModelLoader = new ModelLoader({ logger: mainLogger });
  }
  return voiceModelLoader;
}

function formatVoiceTranscriptionFailure(error) {
  const code = String(error?.code || '').trim();
  const rawMessage = String(error?.message || 'Voice transcription failed').replace(/\s+/g, ' ').trim();
  const safeMessage = rawMessage.slice(0, 220);
  if (code === 'voice_model_missing') {
    return {
      code,
      error: 'Voice model files are missing from this OpenX installation. Rebuild or reinstall OpenX with the bundled Parakeet voice models.'
    };
  }
  if (code === 'voice_onnx_session_failed' || /onnxruntime|onnx|inferencesession/i.test(rawMessage)) {
    return {
      code: code || 'voice_onnx_runtime_failed',
      error: `Voice model runtime failed to start: ${safeMessage}`
    };
  }
  return {
    code: code || 'voice_transcription_failed',
    error: `Voice transcription failed: ${safeMessage}`
  };
}

function scheduleVoiceWarmup(reason = 'startup') {
  if (voiceWarmupTimer || process.env.OPENX_TEST === '1') return;
  voiceWarmupTimer = setTimeout(() => {
    voiceWarmupTimer = null;
    getVoiceModelLoader().load().catch(error => {
      mainLogger.warn('[VOICE] Deferred Parakeet warmup failed', { reason, error: error.message });
    });
  }, VOICE_MODEL_PRELOAD_DELAY_MS);
  voiceWarmupTimer.unref?.();
}

function createVoiceWindow() {
  if (voiceWindow && !voiceWindow.isDestroyed()) return voiceWindow;
  voiceWindow = new BrowserWindow({
    ...topCenterBounds(VOICE_WINDOW_WIDTH, VOICE_WINDOW_HEIGHT),
    show: false,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    focusable: true,
    webPreferences: createSecureWebPreferences(PRELOAD_PATH)
  });
  voiceWindow.setAlwaysOnTop(true, 'screen-saver');
  voiceWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  const voiceFile = path.join(RENDERER_ROOT, 'voice', 'index.html');
  secureWindow(voiceWindow, {
    windowType: 'voice',
    expectedFile: voiceFile,
    createWindow: createVoiceWindow
  });
  forwardRendererConsole(voiceWindow, 'voice-ui');
  voiceWindow.loadFile(voiceFile).catch(error => {
    mainLogger.error('[VOICE] Failed to load voice renderer', { error: error.message });
  });
  voiceWindow.on('closed', () => {
    voiceWindow = null;
  });
  return voiceWindow;
}

function openVoiceWindow(options = {}) {
  const window = createVoiceWindow();
  const activationPayload = {
    reason: String(options.reason || 'manual'),
    greeting: String(options.greeting || ''),
    activatedAt: new Date().toISOString()
  };
  pendingVoiceActivation = activationPayload;
  window.setBounds(topCenterBounds(VOICE_WINDOW_WIDTH, VOICE_WINDOW_HEIGHT));
  window.setAlwaysOnTop(true, 'screen-saver');
  const wasVisible = window.isVisible();
  window.show();
  window.focus();
  getVoiceModelLoader().load().catch(error => {
    mainLogger.warn('[VOICE] On-demand Parakeet load failed', { error: error.message });
  });
  if (!window.webContents.isLoading()) {
    window.webContents.send(wasVisible ? 'voice:interrupted' : 'voice:activated', activationPayload);
  }
  mainLogger.info('[VOICE] Voice window opened', { reason: activationPayload.reason, interrupted: wasVisible });
  return { success: true, visible: true };
}

function closeVoiceWindow() {
  if (!voiceWindow || voiceWindow.isDestroyed()) return { success: true, visible: false };
  voiceWindow.webContents.send('voice:deactivated', { reason: 'closed' });
  voiceWindow.hide();
  return { success: true, visible: false };
}

function consumePendingVoiceActivation() {
  const activationPayload = pendingVoiceActivation || {
    reason: 'startup',
    greeting: '',
    activatedAt: new Date().toISOString()
  };
  pendingVoiceActivation = null;
  return activationPayload;
}

function createIslandWindow() {
  if (islandWindow && !islandWindow.isDestroyed()) return islandWindow;
  islandReady = false;
  islandWindow = new BrowserWindow({
    ...topCenterBounds(ISLAND_WINDOW_WIDTH, ISLAND_WINDOW_HEIGHT),
    show: false,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    focusable: false,
    webPreferences: createSecureWebPreferences(PRELOAD_PATH)
  });
  islandWindow.setAlwaysOnTop(true, 'screen-saver');
  islandWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  islandWindow.setIgnoreMouseEvents(true, { forward: true });
  const islandFile = path.join(RENDERER_ROOT, 'island', 'index.html');
  secureWindow(islandWindow, {
    windowType: 'island',
    expectedFile: islandFile,
    createWindow: createIslandWindow
  });
  forwardRendererConsole(islandWindow, 'island-ui');
  islandWindow.webContents.once('did-finish-load', () => {
    islandReady = true;
    flushPendingIslandItems();
  });
  islandWindow.loadFile(islandFile).catch(error => {
    mainLogger.error('[ISLAND] Failed to load island renderer', { error: error.message });
  });
  islandWindow.on('closed', () => {
    islandWindow = null;
    islandReady = false;
  });
  return islandWindow;
}

function initIslandWindow() {
  createIslandWindow();
}

function flushPendingIslandItems() {
  if (!islandWindow || islandWindow.isDestroyed() || !islandReady) return;
  while (pendingIslandItems.length > 0) {
    islandWindow.webContents.send('island:show', pendingIslandItems.shift());
  }
}

function showIslandItem(item = {}) {
  const text = String(item.text || item.message || item.body || item.title || '').trim();
  if (!text) return false;
  const window = createIslandWindow();
  const payload = {
    id: String(item.id || `island-${Date.now()}`),
    kind: String(item.kind || item.type || 'assistant').toLowerCase(),
    title: String(item.title || '').trim(),
    text,
    dueAt: item.dueAt || item.createdAt || new Date().toISOString(),
    visibleMs: Number(item.visibleMs) || undefined,
    snoozeMinutes: Number(item.snoozeMinutes) || ISLAND_DEFAULT_SNOOZE_MINUTES,
    primaryAction: String(item.primaryAction || '').trim()
  };
  window.setBounds(topCenterBounds(ISLAND_WINDOW_WIDTH, ISLAND_WINDOW_HEIGHT));
  window.setAlwaysOnTop(true, 'screen-saver');
  window.setIgnoreMouseEvents(false);
  window.showInactive();
  if (!islandReady || window.webContents.isLoading()) {
    pendingIslandItems.push(payload);
  } else {
    window.webContents.send('island:show', payload);
  }
  return true;
}

function setIslandIdle() {
  if (islandWindow && !islandWindow.isDestroyed()) {
    islandWindow.setIgnoreMouseEvents(true, { forward: true });
    islandWindow.hide();
  }
  return { success: true };
}

function buildScheduleIslandItem(schedule = {}) {
  const kind = String(schedule.kind || schedule.type || 'reminder').toLowerCase();
  const text = String(schedule.message || schedule.title || schedule.plannerText || 'Scheduled item is due').trim();
  return {
    id: String(schedule.id || schedule.scheduleId || `schedule-${Date.now()}`),
    kind: ['timer', 'alarm', 'schedule', 'calendar'].includes(kind) ? kind : 'reminder',
    title: kind === 'timer' ? 'Timer' : (kind === 'alarm' ? 'Alarm' : (kind === 'calendar' || kind === 'schedule' ? 'Schedule' : 'Reminder')),
    text,
    dueAt: schedule.dueAt || schedule.date || new Date().toISOString(),
    snoozeMinutes: ISLAND_DEFAULT_SNOOZE_MINUTES
  };
}

async function runIslandScheduleAction({ id, kind }, action, minutes = ISLAND_DEFAULT_SNOOZE_MINUTES) {
  if (kind === 'assistant') return { success: true };
  const scheduler = assistant?.automation?.scheduler;
  if (!scheduler) return { success: false, error: 'Scheduler unavailable' };
  const result = action === 'snooze'
    ? await scheduler.snooze(id, minutes)
    : await scheduler.complete(id);
  if (result?.success) {
    sendPlannerEntries('calendar');
    sendScheduleActivitySnapshot(`island-${action}`);
    broadcastScheduleSync();
  }
  return result || { success: false, error: 'Schedule action failed' };
}

function buildSettingsSnapshot() {
  return {
    ...settingsService.getSnapshot(),
    securityStatus: initializeSecurityLock().getStatus()
  };
}

const DEFAULT_CHAT_HISTORY_LIMIT = 300;
const MIN_CHAT_HISTORY_LIMIT = 50;
const MAX_CHAT_HISTORY_LIMIT = 1000;
const UI_STATE_SCHEDULE_LIMIT = 80;
const UI_STATE_NOTIFICATION_LIMIT = 30;

function assistantChatHistoryLimit() {
  const configured = runtimeConfig?.chat?.maxHistory ?? BASE_CONFIG?.chat?.maxHistory ?? DEFAULT_CHAT_HISTORY_LIMIT;
  const numeric = Math.floor(Number(configured));
  const resolved = Number.isFinite(numeric) ? numeric : DEFAULT_CHAT_HISTORY_LIMIT;
  return Math.max(MIN_CHAT_HISTORY_LIMIT, Math.min(MAX_CHAT_HISTORY_LIMIT, resolved));
}

function assistantChatHistoryPath() {
  const dataPaths = runtimeConfig?.app?.dataPaths || BASE_CONFIG?.app?.dataPaths || {};
  return dataPaths.assistantChatHistoryPath || path.join(dataPaths.root || BASE_CONFIG.app.dataDir || app.getPath('userData'), 'assistant-chat-history.json');
}

function legacyAssistantChatHistoryPath() {
  const dataPaths = runtimeConfig?.app?.dataPaths || BASE_CONFIG?.app?.dataPaths || {};
  return path.join(dataPaths.root || BASE_CONFIG.app.dataDir || app.getPath('userData'), 'chat-history.json');
}

function uiStatePath() {
  const dataPaths = runtimeConfig?.app?.dataPaths || BASE_CONFIG?.app?.dataPaths || {};
  return dataPaths.uiStatePath || path.join(dataPaths.root || BASE_CONFIG.app.dataDir || app.getPath('userData'), 'ui-state.json');
}

function redactChatHistoryText(value) {
  return String(value || '')
    .replace(/\b(password|passcode|token|api\s*key|secret|authorization|bearer)\s*[:=]\s*[^\s,;]+/gi, '$1: [redacted]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[email redacted]')
    .slice(0, 4000);
}

function normalizeChatHistoryEntries(entries = []) {
  const limit = assistantChatHistoryLimit();
  return (Array.isArray(entries) ? entries : [])
    .map(entry => {
      const text = redactChatHistoryText(entry?.text);
      if (!text.trim()) return null;
      const type = ['user', 'assistant', 'system'].includes(entry?.type) ? entry.type : 'system';
      return {
        text,
        type,
        meta: redactChatHistoryText(entry?.meta).slice(0, 120),
        createdAt: Number(entry?.createdAt) || Date.now()
      };
    })
    .filter(Boolean)
    .slice(-limit);
}

function mergeChatHistoryEntries(existingEntries = [], incomingEntries = []) {
  const merged = [];
  const seen = new Set();
  [...normalizeChatHistoryEntries(existingEntries), ...normalizeChatHistoryEntries(incomingEntries)].forEach(entry => {
    const key = `${entry.createdAt}:${entry.type}:${entry.text}:${entry.meta}`;
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(entry);
  });
  return merged
    .sort((left, right) => Number(left.createdAt) - Number(right.createdAt))
    .slice(-assistantChatHistoryLimit());
}

function migrateAccidentalAssistantChatHistory() {
  const targetPath = assistantChatHistoryPath();
  const sourcePath = legacyAssistantChatHistoryPath();
  if (path.resolve(targetPath) === path.resolve(sourcePath) || fs.existsSync(targetPath) || !fs.existsSync(sourcePath)) {
    return false;
  }

  const recovered = normalizeChatHistoryEntries(readJsonFile(sourcePath, [], {
    createIfMissing: false,
    validate: value => Array.isArray(value),
    maxBytes: 1024 * 1024
  }));
  if (recovered.length === 0) return false;
  writeJsonAtomic(targetPath, recovered, { backup: false, maxBytes: 1024 * 1024 });
  mainLogger.info('Migrated assistant chat history to dedicated storage', {
    source: path.basename(sourcePath),
    target: path.basename(targetPath),
    count: recovered.length
  });
  return true;
}

function readAssistantChatHistory() {
  migrateAccidentalAssistantChatHistory();
  const primaryPath = assistantChatHistoryPath();
  const entries = normalizeChatHistoryEntries(readJsonFile(primaryPath, [], {
    createIfMissing: true,
    validate: value => Array.isArray(value),
    maxBytes: 1024 * 1024
  }));
  const backupPath = `${primaryPath}.bak`;
  if (entries.length > 0 && fs.existsSync(backupPath)) {
    try {
      const stats = fs.statSync(backupPath);
      if (!stats.isFile() || stats.size > 1024 * 1024) {
        throw new Error('Backup file is invalid or exceeds its size limit');
      }
      const backup = normalizeChatHistoryEntries(readJsonFile(backupPath, [], {
        createIfMissing: false,
        validate: value => Array.isArray(value),
        maxBytes: 1024 * 1024
      }));
      const recovered = mergeChatHistoryEntries(backup, entries);
      if (backup.length > entries.length && recovered.length > entries.length) {
        writeJsonAtomic(primaryPath, recovered, { backup: false, maxBytes: 1024 * 1024 });
        mainLogger.info('Recovered assistant chat history from larger backup', {
          primary: entries.length,
          backup: backup.length,
          recovered: recovered.length
        });
        return recovered;
      }
    } catch (error) {
      mainLogger.warn('Unable to inspect assistant chat history backup', { error: error.message });
    }
  }
  return entries;
}

function writeAssistantChatHistory(entries = []) {
  const existing = readAssistantChatHistory();
  const incoming = normalizeChatHistoryEntries(entries);
  const normalized = mergeChatHistoryEntries(existing, incoming);
  if (incoming.length > 0 && existing.length > incoming.length && normalized.length >= existing.length) {
    mainLogger.info('Preserved existing assistant chat history during snapshot save', {
      existing: existing.length,
      incoming: incoming.length,
      merged: normalized.length
    });
  }
  writeJsonAtomic(assistantChatHistoryPath(), normalized, { maxBytes: 1024 * 1024 });
  return {
    success: true,
    count: normalized.length,
    entries: normalized
  };
}

function relayVoiceConversationToChat(input, result) {
  try {
    if (!input || typeof input !== 'string' || !input.trim()) {
      return;
    }
    const displayName = runtimeConfig?.assistant?.displayName || 'OpenX';
    const replyText = String(result?.response || result?.message || result?.text || '').trim();
    const now = Date.now();
    const entries = [
      { text: String(input).trim(), type: 'user', meta: 'Voice - just now', createdAt: now }
    ];
    if (replyText) {
      entries.push({ text: replyText, type: 'assistant', meta: `${displayName} - voice`, createdAt: now + 1 });
    }
    writeAssistantChatHistory(entries);
    if (chatWindow && !chatWindow.isDestroyed() && !chatWindow.webContents.isLoading()) {
      chatWindow.webContents.send('conversation:append', { entries, result });
    }
  } catch (error) {
    mainLogger.warn('Unable to relay voice conversation to chat', { error: error.message });
  }
}

function clearAssistantChatHistory() {
  writeJsonAtomic(assistantChatHistoryPath(), [], { backup: true, maxBytes: 1024 * 1024 });
  return { success: true, count: 0, entries: [] };
}

function normalizeUiStateText(value, limit = 1000) {
  return String(value || '')
    .replace(/\b(password|passcode|token|api\s*key|secret|authorization|bearer)\s*[:=]\s*[^\s,;]+/gi, '$1: [redacted]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[email redacted]')
    .slice(0, limit);
}

function normalizeUiStateSchedule(entry = {}) {
  const id = normalizeUiStateText(entry.id || entry.taskName || entry.scheduleId, 160);
  const dueTime = new Date(entry.dueAt || '').getTime();
  if (!id || !Number.isFinite(dueTime)) return null;
  const dueAt = new Date(dueTime).toISOString();
  const kind = normalizeUiStateText(entry.kind || 'Reminder', 40);
  const status = normalizeUiStateText(entry.status || 'scheduled', 40).toLowerCase();
  return {
    id,
    kind: ['Timer', 'Alarm', 'Reminder'].includes(kind) ? kind : 'Reminder',
    message: normalizeUiStateText(entry.message || entry.title || kind, 500),
    category: normalizeUiStateText(entry.category || '', 80) || null,
    symbol: normalizeUiStateText(entry.symbol || '', 16) || null,
    dueAt,
    recurrence: normalizeUiStateText(entry.recurrence || '', 160),
    status: ['scheduled', 'paused', 'due'].includes(status) ? status : 'scheduled',
    createdAt: Number.isFinite(Date.parse(entry.createdAt || '')) ? entry.createdAt : new Date().toISOString(),
    source: normalizeUiStateText(entry.source || '', 80) || null
  };
}

function normalizeUiStateNotification(entry = {}) {
  const title = normalizeUiStateText(entry.title || 'Assistant', 160);
  const message = normalizeUiStateText(entry.message || '', 1000);
  if (!title && !message) return null;
  return {
    id: normalizeUiStateText(entry.id || `notice-${Date.now()}`, 160),
    title: title || 'Assistant',
    message,
    tone: normalizeUiStateText(entry.tone || 'info', 40),
    createdAt: Number.isFinite(Date.parse(entry.createdAt || '')) ? entry.createdAt : new Date().toISOString()
  };
}

function normalizeUiState(state = {}) {
  const schedules = (Array.isArray(state?.schedules) ? state.schedules : [])
    .map(normalizeUiStateSchedule)
    .filter(Boolean)
    .slice(0, UI_STATE_SCHEDULE_LIMIT);
  const notifications = (Array.isArray(state?.notifications) ? state.notifications : [])
    .map(normalizeUiStateNotification)
    .filter(Boolean)
    .slice(0, UI_STATE_NOTIFICATION_LIMIT);
  return {
    version: 1,
    assistantMuted: state?.assistantMuted === true,
    schedules,
    notifications,
    updatedAt: new Date().toISOString()
  };
}

function readUiState() {
  return normalizeUiState(readJsonFile(uiStatePath(), () => normalizeUiState(), {
    createIfMissing: true,
    validate: value => value && typeof value === 'object' && !Array.isArray(value),
    maxBytes: 512 * 1024
  }));
}

function writeUiState(state = {}) {
  const normalized = normalizeUiState(state);
  writeJsonAtomic(uiStatePath(), normalized, { backup: true, maxBytes: 512 * 1024 });
  return { success: true, state: normalized };
}

function initializeSecurityLock() {
  if (securityLockService) return securityLockService;
  const dataPaths = runtimeConfig?.app?.dataPaths || BASE_CONFIG?.app?.dataPaths || {};
  securityLockService = new OpenXSecurityLock({
    securityDir: dataPaths.securityDir,
    dataRoot: dataPaths.root
  });
  return securityLockService;
}

function createSettingsWindow() {
  const chatWasOpen = Boolean(chatWindow && !chatWindow.isDestroyed());
  createChatWindow();
  const openSettings = () => {
    if (chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.webContents.send('settings:open');
    }
  };
  if (chatWasOpen) {
    openSettings();
  } else {
    chatWindow.webContents.once('did-finish-load', openSettings);
  }
  return { success: true };
}

function sendPlannerEntries(view = 'calendar') {
  if (!plannerWindow || plannerWindow.isDestroyed()) return;
  try {
    const entries = getPlannerEntriesForRenderer();
    plannerWindow.webContents.send('planner:entriesChanged', { entries, view });
  } catch (error) {
    mainLogger.warn('Failed to send planner entries', { error: error.message });
  }
}

function sendScheduleActivitySnapshot(reason = 'schedule-changed') {
  if (!chatWindow || chatWindow.isDestroyed()) return;
  try {
    chatWindow.webContents.send('schedule:changed', { reason, snapshot: getScheduleSyncSnapshot() });
  } catch (error) {
    mainLogger.warn('Failed to send schedule activity snapshot', { error: error.message });
  }
}

function localPlannerDateKey(date) {
  const value = new Date(date);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function scheduleToPlannerEntry(item) {
  if (!item?.id || !item.dueAt) return null;
  const due = new Date(item.dueAt);
  if (Number.isNaN(due.getTime())) return null;
  const kind = String(item.kind || '').trim() || 'Schedule';
  const isReminderOrAlarm = /^(?:reminder|alarm)$/i.test(kind);
  if (!isReminderOrAlarm || !['scheduled', 'paused', 'due'].includes(item.status)) return null;
  const title = item.message || item.title || kind;
  return {
    id: `schedule-${item.id}`,
    type: 'timetable',
    title,
    notes: item.recurrence ? `${kind} - repeats ${String(item.recurrence).replace(/-/g, ' ')}` : kind,
    date: localPlannerDateKey(due),
    startTime: `${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`,
    endTime: '',
    sourceText: item.title || title,
    sourceKind: kind.toLowerCase(),
    scheduleId: item.id,
    category: item.category || '',
    symbol: item.symbol || '',
    recurrence: item.recurrence || '',
    readonly: true,
    createdAt: item.createdAt || item.dueAt,
    updatedAt: item.dueAt
  };
}

function getPlannerEntriesForRenderer() {
  try {
    const plannerEntries = assistant?.automation?.planner?.listEntries?.()?.data?.entries || [];
    const schedules = assistant?.automation?.scheduler?.listSchedules?.(null, 'all')?.data?.entries || [];
    const scheduleEntries = schedules.map(scheduleToPlannerEntry).filter(Boolean);
    return [...plannerEntries, ...scheduleEntries];
  } catch (error) {
    mainLogger.warn('Failed to collect planner entries', { error: error.message });
    return [];
  }
}

function getScheduleSyncSnapshot() {
  try {
    return assistant?.automation?.scheduler?.getScheduleSnapshot?.('all') || {
      version: 1,
      source: 'desktop',
      generatedAt: new Date().toISOString(),
      count: 0,
      entries: []
    };
  } catch (error) {
    mainLogger.warn('Failed to collect schedule sync snapshot', { error: error.message });
    return { version: 1, source: 'desktop', generatedAt: new Date().toISOString(), count: 0, entries: [] };
  }
}

function upsertScheduleFromPhone(schedule, metadata = {}) {
  try {
    return assistant?.automation?.scheduler?.upsertSyncedSchedule?.(schedule, metadata) ||
      { success: false, error: 'Schedule sync unavailable' };
  } catch (error) {
    mainLogger.warn('[SCHEDULE] Phone sync failed', { error: error.message, source: metadata.source || 'phone' });
    return { success: false, error: 'Unable to sync schedule' };
  }
}

function createCloudSchedulePacket(destinationDevice, snapshot) {
  const status = cloudConnectionManager?.getStatus?.() || {};
  const sourceDevice = status.device || {};
  const owner = status.owner || {};
  const destinationDeviceId = String(destinationDevice?.deviceId || '').trim();
  if (!sourceDevice.deviceId || !owner.id || !destinationDeviceId) return null;
  const requestId = `schedule_sync_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  return {
    packetId: `schedule_packet_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    protocolVersion: 1,
    packetType: 'system',
    sourceDeviceId: sourceDevice.deviceId,
    destinationDeviceId,
    ownerId: owner.id,
    timestamp: Date.now(),
    requestId,
    responseId: null,
    metadata: {
      feature: 'schedule-sync',
      source: 'desktop',
      retryable: false
    },
    checksum: null,
    encryption: null,
    payload: {
      type: 'schedule-sync',
      action: 'snapshot',
      snapshot
    }
  };
}

function broadcastScheduleSync(snapshot = null) {
  const nextSnapshot = snapshot || getScheduleSyncSnapshot();
  try {
    const status = cloudConnectionManager?.getStatus?.() || {};
    if (status.connected !== true) return;
    const devices = Array.isArray(status.pairedDevices) ? status.pairedDevices : [];
    for (const device of devices) {
      if (device?.deviceId === status.device?.deviceId) continue;
      const packet = createCloudSchedulePacket(device, nextSnapshot);
      if (packet) cloudConnectionManager.sendRelayPacket(packet);
    }
  } catch (error) {
    mainLogger.warn('[SCHEDULE] Cloud phone sync broadcast failed', { error: error.message });
  }
}

const PROFILE_SYNC_FIELDS = [
  'fullName',
  'email',
  'phone',
  'addressLine1',
  'city',
  'state',
  'postalCode',
  'country',
  'company',
  'role'
];

function normalizeProfileSyncProfile(profile = {}) {
  const source = profile && typeof profile === 'object' ? profile : {};
  return Object.fromEntries(PROFILE_SYNC_FIELDS.map(field => [
    field,
    String(source[field] || '').replace(/\s+/g, ' ').trim().slice(0, field === 'addressLine1' ? 180 : 120)
  ]));
}

function getProfileSyncSnapshot() {
  const settings = settingsService?.getSettings?.() || {};
  return {
    version: 1,
    source: 'desktop',
    generatedAt: new Date().toISOString(),
    profile: normalizeProfileSyncProfile(settings.userProfile || {})
  };
}

function createCloudProfilePacket(destinationDevice, snapshot, action = 'snapshot') {
  const status = cloudConnectionManager?.getStatus?.() || {};
  const sourceDevice = status.device || {};
  const owner = status.owner || {};
  const destinationDeviceId = String(destinationDevice?.deviceId || destinationDevice).trim();
  if (!sourceDevice.deviceId || !owner.id || !destinationDeviceId) return null;
  const requestId = `profile_sync_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  return {
    packetId: `profile_packet_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    protocolVersion: 1,
    packetType: 'system',
    sourceDeviceId: sourceDevice.deviceId,
    destinationDeviceId,
    ownerId: owner.id,
    timestamp: Date.now(),
    requestId,
    responseId: null,
    metadata: {
      feature: 'profile-sync',
      source: 'desktop',
      retryable: false
    },
    checksum: null,
    encryption: null,
    payload: {
      type: 'profile-sync',
      action,
      snapshot
    }
  };
}

function sendProfileSyncSnapshotToDevice(deviceId, snapshot = null) {
  const packet = createCloudProfilePacket(deviceId, snapshot || getProfileSyncSnapshot());
  return packet ? cloudConnectionManager?.sendRelayPacket?.(packet) === true : false;
}

function broadcastProfileSync(snapshot = null) {
  const nextSnapshot = snapshot || getProfileSyncSnapshot();
  try {
    const status = cloudConnectionManager?.getStatus?.() || {};
    if (status.connected !== true) return false;
    const devices = Array.isArray(status.pairedDevices) ? status.pairedDevices : [];
    let sent = 0;
    for (const device of devices) {
      if (!device?.deviceId || device.deviceId === status.device?.deviceId) continue;
      if (sendProfileSyncSnapshotToDevice(device.deviceId, nextSnapshot)) sent += 1;
    }
    return sent > 0;
  } catch (error) {
    mainLogger.warn('[PROFILE] Cloud profile sync broadcast failed', { error: error.message });
    return false;
  }
}

async function applyProfileSyncFromPhone(profile = {}) {
  const nextProfile = normalizeProfileSyncProfile(profile);
  const saved = settingsService.saveSettings({ userProfile: nextProfile });
  runtimeConfig = settingsService.buildRuntimeConfig();
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.webContents.send('settings:changed', buildSettingsSnapshot());
  }
  const snapshot = {
    version: 1,
    source: 'desktop',
    generatedAt: new Date().toISOString(),
    profile: normalizeProfileSyncProfile(saved.userProfile || nextProfile)
  };
  broadcastProfileSync(snapshot);
  return snapshot;
}

function handleCloudProfileSyncPacket(message = {}) {
  const packet = message.packet || {};
  const payload = packet.payload || {};
  if (payload.type !== 'profile-sync') return false;
  const status = cloudConnectionManager?.getStatus?.() || {};
  if (!status.connected || packet.destinationDeviceId !== status.device?.deviceId || packet.ownerId !== status.owner?.id) return false;
  const action = String(payload.action || 'request').toLowerCase();
  if (action === 'request') {
    sendProfileSyncSnapshotToDevice(packet.sourceDeviceId);
    return true;
  }
  if (action === 'upsert') {
    applyProfileSyncFromPhone(payload.profile || payload.snapshot?.profile || {}).catch(error => {
      mainLogger.warn('[PROFILE] Cloud profile sync apply failed', { error: error.message });
    });
    return true;
  }
  return false;
}

function normalizeModeSyncInstructions(value) {
  const source = Array.isArray(value)
    ? value
    : String(value || '').split(/[\n,]+/);
  return source
    .map(entry => String(entry || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeModeSyncModes(modes = []) {
  return (Array.isArray(modes) ? modes : [])
    .slice(0, 5)
    .map((mode, modeIndex) => {
      const source = mode && typeof mode === 'object' ? mode : {};
      const apps = (Array.isArray(source.apps) ? source.apps : [])
        .slice(0, 5)
        .map(app => {
          const appSource = app && typeof app === 'object' ? app : { name: app };
          return {
            name: String(appSource.name || appSource.appName || '').replace(/\s+/g, ' ').trim().slice(0, 80),
            instructions: normalizeModeSyncInstructions(appSource.instructions || appSource.commands)
          };
        })
        .filter(app => app.name);
      return {
        id: String(source.id || `mode-${modeIndex + 1}`).replace(/\s+/g, '-').slice(0, 80),
        name: String(source.name || '').replace(/\s+/g, ' ').trim().slice(0, 80),
        apps,
        commands: normalizeModeSyncInstructions(source.commands)
      };
    })
    .filter(mode => mode.name || mode.apps.length > 0 || mode.commands.length > 0);
}

function getModesSyncSnapshot() {
  const settings = settingsService?.getSettings?.() || {};
  return {
    version: 1,
    source: 'desktop',
    generatedAt: new Date().toISOString(),
    modes: normalizeModeSyncModes(settings.modes || [])
  };
}

function createCloudModesPacket(destinationDevice, snapshot, action = 'snapshot') {
  const status = cloudConnectionManager?.getStatus?.() || {};
  const sourceDevice = status.device || {};
  const owner = status.owner || {};
  const destinationDeviceId = String(destinationDevice?.deviceId || destinationDevice).trim();
  if (!sourceDevice.deviceId || !owner.id || !destinationDeviceId) return null;
  const requestId = `modes_sync_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  return {
    packetId: `modes_packet_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    protocolVersion: 1,
    packetType: 'system',
    sourceDeviceId: sourceDevice.deviceId,
    destinationDeviceId,
    ownerId: owner.id,
    timestamp: Date.now(),
    requestId,
    responseId: null,
    metadata: {
      feature: 'modes-sync',
      source: 'desktop',
      retryable: false
    },
    checksum: null,
    encryption: null,
    payload: {
      type: 'modes-sync',
      action,
      snapshot
    }
  };
}

function sendModesSyncSnapshotToDevice(deviceId, snapshot = null) {
  const packet = createCloudModesPacket(deviceId, snapshot || getModesSyncSnapshot());
  return packet ? cloudConnectionManager?.sendRelayPacket?.(packet) === true : false;
}

function broadcastModesSync(snapshot = null) {
  const nextSnapshot = snapshot || getModesSyncSnapshot();
  try {
    const status = cloudConnectionManager?.getStatus?.() || {};
    if (status.connected !== true) return false;
    const devices = Array.isArray(status.pairedDevices) ? status.pairedDevices : [];
    let sent = 0;
    for (const device of devices) {
      if (!device?.deviceId || device.deviceId === status.device?.deviceId) continue;
      if (sendModesSyncSnapshotToDevice(device.deviceId, nextSnapshot)) sent += 1;
    }
    return sent > 0;
  } catch (error) {
    mainLogger.warn('[MODES] Cloud modes sync broadcast failed', { error: error.message });
    return false;
  }
}

async function applyModesSyncFromPhone(modes = []) {
  const nextModes = normalizeModeSyncModes(modes);
  const saved = settingsService.saveSettings({ modes: nextModes });
  await reloadRuntimeServices();
  const snapshot = {
    version: 1,
    source: 'desktop',
    generatedAt: new Date().toISOString(),
    modes: normalizeModeSyncModes(saved.modes || nextModes)
  };
  broadcastModesSync(snapshot);
  return snapshot;
}

function handleCloudModesSyncPacket(message = {}) {
  const packet = message.packet || {};
  const payload = packet.payload || {};
  if (payload.type !== 'modes-sync') return false;
  const status = cloudConnectionManager?.getStatus?.() || {};
  if (!status.connected || packet.destinationDeviceId !== status.device?.deviceId || packet.ownerId !== status.owner?.id) return false;
  const action = String(payload.action || 'request').toLowerCase();
  if (action === 'request') {
    sendModesSyncSnapshotToDevice(packet.sourceDeviceId);
    return true;
  }
  if (action === 'upsert') {
    applyModesSyncFromPhone(payload.modes || payload.snapshot?.modes || []).catch(error => {
      mainLogger.warn('[MODES] Cloud modes sync apply failed', { error: error.message });
    });
    return true;
  }
  return false;
}

function getRemoteControlTargets() {
  const result = assistant?.automation?.remote?.listTargets?.();
  if (result?.success === false) return result;
  return result || { success: true, data: { targets: [], count: 0 } };
}

function sendRemoteControlAction(payload = {}) {
  const result = assistant?.automation?.remote?.sendControl?.(payload);
  return result || {
    success: false,
    error: 'Remote control is not ready.',
    data: { action: 'remote.control' }
  };
}

async function handleCloudRemoteControl(payload = {}) {
  if (payload.action === 'listTargets') {
    return getRemoteControlTargets();
  }
  if (payload.action === 'control') {
    return sendRemoteControlAction({
      targetId: payload.targetId,
      action: payload.command,
      windowTitle: payload.windowTitle,
      tabTitle: payload.tabTitle,
      targetHandle: payload.targetHandle,
      targetProcessId: payload.targetProcessId,
      processName: payload.processName
    });
  }
  return {
    success: false,
    error: 'Unsupported remote control action.',
    data: { action: 'remote.control' }
  };
}

function lowerChatWindowForPlanner() {
  if (!chatWindow || chatWindow.isDestroyed() || !chatWindow.isVisible()) return;
  chatWindow.setAlwaysOnTop(false);
  chatWindow.blur();
  chatLoweredForPlanner = true;
}

function restoreChatWindowPriority() {
  if (!chatLoweredForPlanner) return;
  chatLoweredForPlanner = false;
  if (!chatWindow || chatWindow.isDestroyed()) return;
  chatWindow.setAlwaysOnTop(true);
}

function createPlannerWindow(initialView = 'calendar', options = {}) {
  const view = initialView === 'timetable' ? 'timetable' : 'calendar';
  if (plannerWindow && !plannerWindow.isDestroyed()) {
    plannerWindow.show();
    plannerWindow.focus();
    plannerWindow.webContents.send('planner:view', view);
    sendPlannerEntries(view);
    if (options.lowerChat) lowerChatWindowForPlanner();
    return;
  }

  plannerWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 860,
    minHeight: 600,
    transparent: true,
    frame: false,
    resizable: true,
    skipTaskbar: false,
    alwaysOnTop: false,
    hasShadow: true,
    show: false,
    paintWhenInitiallyHidden: true,
    backgroundColor: '#00000000',
    webPreferences: createSecureWebPreferences(PRELOAD_PATH)
  });

  const plannerFile = path.join(RENDERER_ROOT, 'planner', 'index.html');
  secureWindow(plannerWindow, {
    windowType: 'planner',
    expectedFile: plannerFile,
    createWindow: () => createPlannerWindow(view, options)
  });
  let didRevealPlanner = false;
  const revealPlanner = () => {
    if (didRevealPlanner || !plannerWindow || plannerWindow.isDestroyed()) return;
    didRevealPlanner = true;
    plannerWindow.center();
    plannerWindow.show();
    plannerWindow.focus();
    if (options.lowerChat) lowerChatWindowForPlanner();
  };
  plannerWindow.once('ready-to-show', revealPlanner);
  plannerWindow.loadFile(plannerFile).then(() => {
    if (plannerWindow && !plannerWindow.isDestroyed()) {
      plannerWindow.webContents.send('planner:view', view);
      sendPlannerEntries(view);
      revealPlanner();
    }
  }).catch(error => {
    mainLogger.error('Failed to load planner renderer', { error: error.message });
  });
  plannerWindow.on('closed', () => {
    plannerWindow = null;
    restoreChatWindowPriority();
  });
}

function cloudTransferDisplayName(transfer = {}) {
  return String(transfer.fileName || 'file').replace(/\s+/g, ' ').trim().slice(0, 160) || 'file';
}

function getCloudReceivedDirectory() {
  return runtimeConfig?.app?.dataPaths?.cloudReceivedDir ||
    BASE_CONFIG.app?.dataPaths?.cloudReceivedDir ||
    path.join(app.getPath('documents'), 'OpenX');
}

function getTimerWidgetState(preferredId = null, options = {}) {
  const includeStopwatch = options.includeStopwatch === true || timerWidgetMode === 'stopwatch';
  const state = assistant?.automation?.scheduler?.getTimerWidgetState?.(preferredId, { includeStopwatch });
  if (!includeStopwatch && state?.mode === 'stopwatch') return { visible: false };
  return state || { visible: false };
}

function positionTimerWidget() {
  if (!timerWidgetWindow || timerWidgetWindow.isDestroyed()) return;
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const area = display?.workArea || screen.getPrimaryDisplay().workArea;
  const [width, height] = timerWidgetWindow.getSize();
  timerWidgetWindow.setBounds({
    x: Math.round(area.x + area.width - width - 22),
    y: Math.round(area.y + area.height - height - 24),
    width,
    height
  });
}

function sendTimerWidgetState(state = null) {
  if (!timerWidgetWindow || timerWidgetWindow.isDestroyed()) return;
  const nextState = state || getTimerWidgetState(null, { includeStopwatch: timerWidgetMode === 'stopwatch' });
  timerWidgetMode = nextState?.visible ? nextState.mode : null;
  timerWidgetWindow.webContents.send('timerWidget:state', nextState);
}

function hideTimerWidget() {
  if (timerWidgetWindow && !timerWidgetWindow.isDestroyed()) {
    timerWidgetWindow.close();
  }
  timerWidgetMode = null;
}

function showTimerWidget(preferredId = null, options = {}) {
  const state = getTimerWidgetState(preferredId, options);
  if (!state.visible) {
    hideTimerWidget();
    return;
  }
  timerWidgetMode = state.mode;

  if (timerWidgetWindow && !timerWidgetWindow.isDestroyed()) {
    positionTimerWidget();
    timerWidgetWindow.showInactive();
    sendTimerWidgetState(state);
    return;
  }

  timerWidgetWindow = new BrowserWindow({
    width: 154,
    height: 154,
    transparent: true,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: true,
    webPreferences: createSecureWebPreferences(PRELOAD_PATH)
  });
  timerWidgetWindow.setAlwaysOnTop(true, 'screen-saver');
  const widgetFile = path.join(RENDERER_ROOT, 'timer-widget', 'index.html');
  secureWindow(timerWidgetWindow, {
    windowType: 'timer-widget',
    expectedFile: widgetFile,
    createWindow: () => showTimerWidget(preferredId, options)
  });
  timerWidgetWindow.loadFile(widgetFile).then(() => {
    if (timerWidgetWindow && !timerWidgetWindow.isDestroyed()) {
      positionTimerWidget();
      timerWidgetWindow.showInactive();
      sendTimerWidgetState(state);
    }
  }).catch(error => {
    mainLogger.error('Failed to load timer widget renderer', { error: error.message });
  });
  timerWidgetWindow.on('closed', () => {
    timerWidgetWindow = null;
    timerWidgetMode = null;
  });
}

function handleTimerWidgetCommand(payload) {
  if (!payload?.success || !payload.intent) return;
  const intent = String(payload.intent);
  if (!/^stopwatch\./.test(intent)) return;
  if (intent === 'stopwatch.cancel') {
    hideTimerWidget();
    return;
  }
  const preferredId = payload.data?.id || payload.data?.taskName || null;
  if (intent === 'stopwatch.start' || intent === 'stopwatch.reset') {
    showTimerWidget(preferredId, { includeStopwatch: intent.startsWith('stopwatch.') });
    return;
  }
  if (timerWidgetWindow && !timerWidgetWindow.isDestroyed()) {
    sendTimerWidgetState(getTimerWidgetState(preferredId, { includeStopwatch: timerWidgetMode === 'stopwatch' }));
  }
}

function handlePlannerCommand(payload) {
  if (!payload?.success || !payload.intent) return;
  const intent = String(payload.intent);
  if (/^(?:reminder|alarm)\.(?:set|cancel|clear|snooze|list)$/.test(intent)) {
    sendPlannerEntries('calendar');
    sendScheduleActivitySnapshot('planner-command');
    return;
  }
  if (!/^(?:calendar|timetable)\./.test(intent)) return;
  createPlannerWindow('calendar');
}

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);

  tray.setToolTip(`${runtimeConfig?.assistant?.displayName || 'OpenX'} Assistant`);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Chat', click: () => createChatWindow() },
    { label: 'Calendar / Timetable', click: () => createPlannerWindow('calendar') },
    { label: 'Settings', click: () => createSettingsWindow() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);

  tray.setContextMenu(contextMenu);
  tray.setIgnoreDoubleClickEvents(false);
  tray.on('double-click', () => createChatWindow());
}

function sendCloudStatus(status = null) {
  const payload = status || cloudConnectionManager?.getStatus?.() || {
    state: 'Disconnected',
    connected: false,
    friendlyMessage: 'Cloud mode is disconnected. Local mode is active.'
  };
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.webContents.send('cloud:status', payload);
  }
}

function sendCloudPairingStatus(status = null) {
  const payload = status || cloudPairingManager?.getStatus?.() || {
    connected: false,
    hasActiveQr: false,
    currentPairing: null,
    pendingRequests: []
  };
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.webContents.send('cloud:pairing:status', payload);
  }
}

function getCloudE2EEKeyPath() {
  const dataPaths = runtimeConfig?.app?.dataPaths || BASE_CONFIG.app?.dataPaths || {};
  const securityDir = dataPaths.securityDir || path.join(dataPaths.root || app.getPath('userData'), 'security');
  return path.join(securityDir, 'cloud-e2ee-key.json');
}

function loadCloudE2EEMasterKey() {
  try {
    const keyPath = getCloudE2EEKeyPath();
    if (!fs.existsSync(keyPath)) return '';
    const stored = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    if (stored?.storage !== 'electron-safeStorage' || !stored?.ciphertext) return '';
    if (!safeStorage?.isEncryptionAvailable?.()) return '';
    return safeStorage.decryptString(Buffer.from(stored.ciphertext, 'base64')).trim();
  } catch (error) {
    mainLogger.warn('[CLOUD] Unable to load encrypted E2EE key', { error: error.message });
    return '';
  }
}

function saveCloudE2EEMasterKey(masterKey) {
  const key = String(masterKey || '').trim();
  if (!key) return false;
  if (!safeStorage?.isEncryptionAvailable?.()) {
    mainLogger.warn('[CLOUD] E2EE key not persisted because OS encryption is unavailable');
    return false;
  }
  try {
    const keyPath = getCloudE2EEKeyPath();
    fs.mkdirSync(path.dirname(keyPath), { recursive: true, mode: 0o700 });
    const ciphertext = safeStorage.encryptString(key).toString('base64');
    fs.writeFileSync(keyPath, JSON.stringify({
      version: 1,
      storage: 'electron-safeStorage',
      createdAt: new Date().toISOString(),
      ciphertext
    }, null, 2), { mode: 0o600 });
    try { fs.chmodSync(keyPath, 0o600); } catch (_) {}
    return true;
  } catch (error) {
    mainLogger.warn('[CLOUD] Unable to persist encrypted E2EE key', { error: error.message });
    return false;
  }
}

function deleteCloudE2EEMasterKey() {
  try {
    const keyPath = getCloudE2EEKeyPath();
    if (fs.existsSync(keyPath)) fs.rmSync(keyPath, { force: true });
    return true;
  } catch (error) {
    mainLogger.warn('[CLOUD] Unable to delete encrypted E2EE key', { error: error.message });
    return false;
  }
}

function createCloudSecureKeyStore() {
  return {
    saveMasterKey: saveCloudE2EEMasterKey,
    loadMasterKey: loadCloudE2EEMasterKey,
    deleteMasterKey: deleteCloudE2EEMasterKey
  };
}

function sendHomeOnboardingStatus(snapshot = null) {
  if (!chatWindow || chatWindow.isDestroyed()) return;
  const payload = snapshot || homeOnboardingManager?.getSnapshot?.() || null;
  if (!payload) return;
  chatWindow.webContents.send('homeOnboarding:changed', toIpcSafeValue(payload));
}

function normalizeHomeServerHttpBaseUrl(serverAddress) {
  const parsed = new URL(String(serverAddress || 'wss://openx-server.onrender.com/ws').trim());
  if (parsed.protocol === 'ws:') parsed.protocol = 'http:';
  if (parsed.protocol === 'wss:') parsed.protocol = 'https:';
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('OpenX_Server address must use http, https, ws, or wss.');
  }
  parsed.pathname = '';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

async function fetchHomeServerJson(serverAddress, route, options = {}) {
  const baseUrl = normalizeHomeServerHttpBaseUrl(serverAddress);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(options.timeoutMs) || 9000);
  timeout.unref?.();
  try {
    const response = await fetch(`${baseUrl}${route}`, {
      method: options.method || 'GET',
      headers: {
        accept: 'application/json',
        ...(options.body ? { 'content-type': 'application/json' } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.success === false) {
      return {
        success: false,
        statusCode: response.status,
        code: body?.code || `http-${response.status}`,
        message: body?.message || `OpenX_Server returned ${response.status}.`,
        ...body
      };
    }
    return { success: true, statusCode: response.status, ...body };
  } catch (error) {
    return {
      success: false,
      code: error.name === 'AbortError' ? 'home-server-timeout' : 'home-server-unreachable',
      message: error.name === 'AbortError'
        ? 'OpenX_Server home request timed out.'
        : `OpenX_Server home request failed: ${error.message}`
    };
  } finally {
    clearTimeout(timeout);
  }
}

function createHomeServerClient(defaultOwnerId = 'desktop-owner') {
  return {
    async listHomeDevices({ serverAddress, ownerId = defaultOwnerId } = {}) {
      const query = ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : '';
      return fetchHomeServerJson(serverAddress, `/home/devices${query}`);
    },

    async getHomeDevice({ serverAddress, deviceId } = {}) {
      const normalizedDeviceId = String(deviceId || '').trim();
      if (!normalizedDeviceId) return { success: false, code: 'missing-device-id', message: 'Home device ID is required.' };
      return fetchHomeServerJson(serverAddress, `/home/devices/${encodeURIComponent(normalizedDeviceId)}`);
    },

    async approveHomePairing({ device, ownerId = defaultOwnerId, serverAddress }) {
      const deviceId = String(device?.deviceId || '').trim();
      if (!deviceId) return { success: false, code: 'missing-device-id', message: 'Home device ID is required.' };
      const desktopDeviceId = String(cloudConnectionManager?.device?.deviceId || runtimeConfig?.cloud?.deviceId || 'openx-desktop').trim();
      const pairRequest = await fetchHomeServerJson(serverAddress, '/home/pairing/request', {
        method: 'POST',
        body: {
          deviceId,
          ownerId,
          desktopDeviceId,
          pairingLabel: device?.deviceName || 'OpenX Home Device',
          metadata: { source: 'openx-desktop' }
        }
      });
      if (!pairRequest.success && pairRequest.code !== 'home-device-owned') return pairRequest;
      const pairingSessionId = pairRequest.session?.pairingSessionId || pairRequest.pairRequest?.pairingSessionId || '';
      if (!pairingSessionId && pairRequest.code === 'home-device-owned') {
        return {
          success: true,
          paired: true,
          ownerId,
          deviceId,
          serverAddress,
          message: 'Home device is already paired.'
        };
      }
      const approved = await fetchHomeServerJson(serverAddress, '/home/pairing/approve', {
        method: 'POST',
        body: {
          pairingSessionId,
          deviceId,
          ownerId,
          approvedByDeviceId: desktopDeviceId
        }
      });
      return approved.success
        ? { ...approved, paired: true, ownerId, deviceId, serverAddress }
        : approved;
    },

    async renameDevice({ serverAddress, deviceId, ownerId = defaultOwnerId, deviceName }) {
      const normalizedDeviceId = String(deviceId || '').trim();
      if (!normalizedDeviceId) return { success: false, code: 'missing-device-id', message: 'Home device ID is required.' };
      return fetchHomeServerJson(serverAddress, `/home/devices/${encodeURIComponent(normalizedDeviceId)}`, {
        method: 'PATCH',
        body: { ownerId, deviceName }
      });
    },

    async forgetDevice({ serverAddress, deviceId, ownerId = defaultOwnerId }) {
      const normalizedDeviceId = String(deviceId || '').trim();
      if (!normalizedDeviceId) return { success: false, code: 'missing-device-id', message: 'Home device ID is required.' };
      return fetchHomeServerJson(serverAddress, `/home/devices/${encodeURIComponent(normalizedDeviceId)}`, {
        method: 'DELETE',
        body: { ownerId }
      });
    }
  };
}

function initializeHomeOnboarding() {
  if (homeOnboardingManager) return homeOnboardingManager;
  const defaultServerAddress = runtimeConfig?.cloud?.relayUrl || 'wss://openx-server.onrender.com/ws';
  const dataPaths = runtimeConfig?.app?.dataPaths || BASE_CONFIG.app?.dataPaths || {};
  const ownerId = resolveHomeOwnerId({ dataPaths });
  const homeDeviceStore = new HomeDeviceStore({ dataPaths });
  const discoveryTransport = new HomeLanDiscoveryTransport({
    logger: mainLogger
  });
  const serverClient = createHomeServerClient(ownerId);
  homeOnboardingManager = new HomeOnboardingManager({
    defaultServerAddress,
    serverClient,
    ownerId,
    discovery: {
      transport: discoveryTransport,
      store: homeDeviceStore
    },
    pairing: {
      serverClient
    }
  });
  homeOnboardingManager.discovery.subscribe(() => sendHomeOnboardingStatus());
  homeOnboardingManager.startDiscovery();
  homeOnboardingManager.refreshServerDevices?.()
    .then(() => sendHomeOnboardingStatus())
    .catch(error => mainLogger.warn('[HOME] Server device refresh failed', { error: error.message }));
  // OpenX_Server keeps its device registry in memory only, so a redeploy or
  // restart silently un-pairs every device. Poll in the background so a
  // previously-paired device gets its ownership reclaimed automatically
  // (see HomeOnboardingManager.reclaimDevice) instead of the user having to
  // notice it's broken and redo Bluetooth + Wi-Fi setup from scratch.
  const homeRefreshTimer = setInterval(() => {
    homeOnboardingManager.refreshServerDevices?.()
      .then(result => {
        if (result?.added || result?.reclaimed || result?.reclaimFailed) {
          mainLogger.info('[HOME] Background Home Device refresh completed', {
            devicesSeen: Array.isArray(result.devices) ? result.devices.length : 0,
            devicesAdded: Number(result.added || 0),
            reclaimed: Number(result.reclaimed || 0),
            reclaimFailed: Number(result.reclaimFailed || 0)
          });
        }
        sendHomeOnboardingStatus();
      })
      .catch(error => mainLogger.warn('[HOME] Background device refresh failed', { error: error.message }));
  }, 30000);
  homeRefreshTimer.unref?.();
  mainLogger.info('[HOME] Home Device discovery started', {
    defaultServerAddress
  });
  return homeOnboardingManager;
}

function wireHomeAutomationExecution() {
  if (!assistant?.automation?.homeAutomation || !cloudConnectionManager) return;
  const dataPaths = runtimeConfig?.app?.dataPaths || BASE_CONFIG.app?.dataPaths || {};
  const ownerId = resolveHomeOwnerId({ dataPaths });
  if (!homeCommandClient) {
    homeCommandClient = new HomeCommandClient({
      sendPacket: packet => cloudConnectionManager.sendHomePacket(packet),
      subscribe: handler => {
        cloudConnectionManager.on('home-packet', handler);
        return () => cloudConnectionManager.off('home-packet', handler);
      },
      isConnected: () => cloudConnectionManager.isConnected()
    });
  }
  assistant.automation.homeAutomation.configureLiveExecution({
    getPairedDevices: () => initializeHomeOnboarding().discovery.listDevices(),
    commandClient: homeCommandClient,
    ownerId
  });
  mainLogger.info('[HOME] Live device-command execution wired', { ownerId });
}

function initializeCloudConnection() {
  if (cloudConnectionManager) return cloudConnectionManager;
  const dataPaths = runtimeConfig?.app?.dataPaths || BASE_CONFIG.app?.dataPaths || {};
  const cloudLogger = new CloudLogger({
    logger: mainLogger,
    logPath: dataPaths.cloudLogPath
  });
  cloudConnectionManager = new CloudConnectionManager({
    settings: runtimeConfig?.cloud || {},
    version: app.getVersion?.() || BASE_CONFIG.app?.version || '0.0.0',
    e2eeMasterKey: loadCloudE2EEMasterKey(),
    logger: cloudLogger
  });
  cloudConnectionManager.on('status', status => sendCloudStatus(status));
  return cloudConnectionManager;
}

function initializeCloudPairing() {
  if (cloudPairingManager) return cloudPairingManager;
  const manager = initializeCloudConnection();
  cloudPairingManager = new CloudPairingManager({
    connectionManager: manager,
    logger: mainLogger,
    secureKeyStore: createCloudSecureKeyStore(),
    tokenTtlMs: runtimeConfig?.cloud?.pairTokenTtlMs || 5 * 60 * 1000
  });
  cloudPairingManager.on('request', status => {
    sendCloudPairingStatus(status);
    if (chatWindow && !chatWindow.isDestroyed()) {
      revealChatWindow();
    }
  });
  cloudPairingManager.on('result', result => {
    sendCloudPairingStatus();
    mainLogger.info('[CLOUD] Pairing result received', {
      pairRequestId: result?.pairRequestId,
      type: result?.type
    });
    if (result?.type === 'cloud-pair:paired') {
      setTimeout(() => broadcastProfileSync(), 500).unref?.();
    }
  });
  cloudPairingManager.on('status', status => sendCloudPairingStatus(status));
  return cloudPairingManager;
}

function initializeCloudCommands() {
  if (cloudCommandManager) return cloudCommandManager;
  const manager = initializeCloudConnection();
  const cloudSettings = runtimeConfig?.cloud || {};
  cloudCommandManager = new CloudCommandManager({
    connectionManager: manager,
    assistantProvider: () => assistant,
    logger: mainLogger,
    scheduleProvider: getScheduleSyncSnapshot,
    scheduleUpsertHandler: upsertScheduleFromPhone,
    remoteControlHandler: handleCloudRemoteControl,
    executionTimeoutMs: cloudSettings.commandExecutionTimeoutMs || 60000,
    queueMode: cloudSettings.commandQueueMode || 'queue',
    maxQueueSize: cloudSettings.commandMaxQueueSize || 25
  });
  cloudCommandManager.on('lifecycle', event => {
    mainLogger.info('[CLOUD] Command lifecycle', {
      requestId: event?.requestId || null,
      state: event?.state || 'unknown',
      sourceDeviceId: event?.sourceDeviceId || null,
      destinationDeviceId: event?.destinationDeviceId || null
    });
    if (['executing', 'queued'].includes(event?.state)) {
      manager.updatePresence?.('busy', { reason: 'assistant-executing' });
    } else if (['completed', 'failed', 'timed-out', 'rejected'].includes(event?.state)) {
      manager.updatePresence?.('online', { reason: 'assistant-idle' });
    }
  });
  cloudCommandManager.on('assistant-command', event => {
    mainLogger.info('Cloud assistant command received from mobile', {
      requestId: event?.request?.requestId || null,
      deviceName: event?.deviceName || event?.request?.deviceName || null
    });
  });
  cloudCommandManager.on('assistant-result', event => {
    mainLogger.info('Cloud assistant result returned to mobile', {
      requestId: event?.request?.requestId || null,
      status: event?.status || null,
      success: event?.result?.success === true
    });
  });
  cloudCommandManager.start();
  return cloudCommandManager;
}

function initializeCloudFileTransfers() {
  if (cloudFileTransferManager) return cloudFileTransferManager;
  const manager = initializeCloudConnection();
  cloudFileTransferManager = new CloudFileTransferManager({
    connectionManager: manager,
    logger: mainLogger,
    receiveDirectory: runtimeConfig?.app?.dataPaths?.cloudReceivedDir,
    tempDirectory: runtimeConfig?.app?.dataPaths?.cloudTempDir,
    chunkBytes: runtimeConfig?.cloud?.fileTransferChunkBytes || 12 * 1024,
    timeoutMs: runtimeConfig?.cloud?.fileTransferTimeoutMs || 10 * 60 * 1000
  });
  cloudFileTransferManager.on('incoming-transfer', transfer => {
    mainLogger.info('[CLOUD-FILE] Incoming file transfer needs approval', {
      transferId: transfer.transferId,
      fileName: transfer.fileName,
      fileSize: transfer.fileSize,
      sourceDeviceId: transfer.sourceDeviceId,
      destination: getCloudReceivedDirectory()
    });
  });
  cloudFileTransferManager.on('progress', transfer => {
    mainLogger.info('[CLOUD-FILE] Transfer progress', {
      transferId: transfer.transferId,
      state: transfer.state,
      percent: transfer.percent
    });
    const busyStates = new Set(['pending', 'accepted', 'transferring', 'receiving', 'downloading', 'uploading', 'waiting-approval']);
    if (busyStates.has(String(transfer.state || '').toLowerCase())) {
      manager.updatePresence?.('busy', { reason: 'file-transfer' });
    } else {
      manager.updatePresence?.('online', { reason: 'file-transfer-complete' });
    }
  });
  cloudFileTransferManager.on('completed', transfer => {
    mainLogger.info('[CLOUD-FILE] Transfer completed', {
      transferId: transfer.transferId,
      fileName: transfer.fileName,
      filePath: transfer.filePath || null
    });
    manager.updatePresence?.('online', { reason: 'file-transfer-complete' });
  });
  cloudFileTransferManager.on('failed', transfer => {
    mainLogger.warn('[CLOUD-FILE] Transfer failed', {
      transferId: transfer.transferId,
      fileName: transfer.fileName || null,
      reason: transfer.reason || transfer.error || 'unknown'
    });
    manager.updatePresence?.('online', { reason: 'file-transfer-failed' });
  });
  cloudFileTransferManager.start();
  return cloudFileTransferManager;
}

async function maybeAutoConnectCloud(reason = 'startup') {
  const manager = initializeCloudConnection();
  manager.updateSettings(runtimeConfig?.cloud || {});
  const cloudSettings = runtimeConfig?.cloud || {};
  if (cloudSettings.enabled !== true || cloudSettings.autoConnect !== true) {
    mainLogger.info('[CLOUD] Auto connect skipped', {
      reason,
      enabled: cloudSettings.enabled === true,
      autoConnect: cloudSettings.autoConnect === true
    });
    sendCloudStatus(manager.getStatus());
    return manager.getStatus();
  }

  try {
    return await manager.connect(cloudSettings);
  } catch (error) {
    mainLogger.warn('[CLOUD] Auto connect failed safely', { reason, error: error.message });
    return manager.getStatus();
  }
}

function currentCloudSettings() {
  const settings = settingsService?.getSettings?.()?.cloud || runtimeConfig?.cloud || {};
  return { ...settings };
}

const CLOUD_DEVICE_LIST_TIMEOUT_MS = 2500;
const CLOUD_DEVICE_LIST_SUCCESS_TTL_MS = 5000;
const CLOUD_DEVICE_LIST_FAILURE_COOLDOWN_MS = 30000;
let cloudDeviceListRefreshPromise = null;
let cloudDeviceListLastSuccessAt = 0;
let cloudDeviceListLastFailureAt = 0;
let cloudDeviceListLastFailureLogAt = 0;

function coerceCloudTimestamp(value, fallback = Date.now()) {
  if (Number.isFinite(Number(value)) && Number(value) > 0) return Number(value);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function refreshManagedCloudDevices(manager) {
  if (!manager?.isConnected?.()) return false;
  const now = Date.now();
  if (cloudDeviceListRefreshPromise) {
    await cloudDeviceListRefreshPromise;
    return true;
  }
  if (now - cloudDeviceListLastSuccessAt < CLOUD_DEVICE_LIST_SUCCESS_TTL_MS) return true;
  if (now - cloudDeviceListLastFailureAt < CLOUD_DEVICE_LIST_FAILURE_COOLDOWN_MS) return false;

  cloudDeviceListRefreshPromise = manager.listDevices({ timeoutMs: CLOUD_DEVICE_LIST_TIMEOUT_MS })
    .then(() => {
      cloudDeviceListLastSuccessAt = Date.now();
      cloudDeviceListLastFailureAt = 0;
      return true;
    })
    .catch(error => {
      const failedAt = Date.now();
      cloudDeviceListLastFailureAt = failedAt;
      if (failedAt - cloudDeviceListLastFailureLogAt >= CLOUD_DEVICE_LIST_FAILURE_COOLDOWN_MS) {
        cloudDeviceListLastFailureLogAt = failedAt;
        mainLogger.warn('Cloud device list refresh failed; using cached devices', { error: error.message });
      } else {
        mainLogger.debug?.('Cloud device list refresh skipped after recent failure', { error: error.message });
      }
      return false;
    })
    .finally(() => {
      cloudDeviceListRefreshPromise = null;
    });

  await cloudDeviceListRefreshPromise;
  return true;
}

async function buildManagedDeviceList() {
  const manager = cloudConnectionManager || initializeCloudConnection();
  if (manager?.isConnected?.()) {
    try {
      await refreshManagedCloudDevices(manager);
    } catch (error) {
      mainLogger.debug?.('Cloud device list refresh fallback failed safely', { error: error.message });
    }
  }
  const cloudStatus = cloudConnectionManager?.getStatus?.() || {};
  const cloudById = new Map((cloudStatus.pairedDevices || []).map(device => [device.deviceId, device]));
  const output = [];
  const currentDeviceId = cloudStatus.device?.deviceId || runtimeConfig?.cloud?.deviceId || '';

  for (const cloud of cloudById.values()) {
    if (currentDeviceId && cloud.deviceId === currentDeviceId) {
      continue;
    }
    output.push({
      deviceId: cloud.deviceId,
      deviceName: cloud.friendlyName || cloud.deviceName || cloud.deviceId,
      friendlyName: cloud.friendlyName || cloud.deviceName || cloud.deviceId,
      deviceType: cloud.deviceType || 'future',
      platform: cloud.platform || '',
      softwareVersion: cloud.softwareVersion || '',
      pairedAt: coerceCloudTimestamp(cloud.createdAt),
      lastSeen: coerceCloudTimestamp(cloud.lastSeen || cloud.updatedAt),
      trusted: true,
      trustStatus: 'trusted',
      permissions: {},
      source: 'cloud',
      connectionStatus: cloud.connectionState || 'cloud-paired',
      connected: cloud.connectionState === 'connected',
      connectionDurationMs: 0,
      sessionStatus: 'cloud',
      session: null,
      isCurrentDevice: cloud.deviceId === currentDeviceId,
      pairBoxCode: cloud.pairBoxCode || cloud.pairBoxes?.[0]?.boxCode || '',
      pairBoxId: cloud.pairBoxId || cloud.pairBoxes?.[0]?.id || '',
      pairDeviceIds: Array.isArray(cloud.pairDeviceIds) ? cloud.pairDeviceIds : (cloud.pairBoxes?.[0]?.deviceIds || []),
      pairBoxes: Array.isArray(cloud.pairBoxes) ? cloud.pairBoxes : [],
      cloud
    });
  }
  return output.sort((left, right) => {
    const leftConnected = left.connected ? 0 : 1;
    const rightConnected = right.connected ? 0 : 1;
    if (leftConnected !== rightConnected) return leftConnected - rightConnected;
    return String(left.deviceName || '').localeCompare(String(right.deviceName || ''));
  });
}

function registerIpcHandler(channel, handler) {
  const validator = IPC_VALIDATORS[channel];
  if (!validator) throw new Error(`No IPC validator registered for ${channel}`);

  ipcMain.handle(channel, async (event, payload) => {
    try {
      assertTrustedIpcSender(event, RENDERER_ROOT);
      const validatedPayload = validator(payload);
      return await handler(event, validatedPayload);
    } catch (error) {
      mainLogger.warn('IPC request rejected', {
        channel,
        sender: getIpcSenderUrl(event),
        senderWebContentsId: event?.sender?.id || null,
        senderWindowId: event?.sender ? BrowserWindow.fromWebContents(event.sender)?.id || null : null,
        error: error.message
      });
      throw new Error('Invalid or unauthorized IPC request');
    }
  });
}

function registerSyncIpcHandler(channel, handler) {
  const validator = IPC_VALIDATORS[channel];
  if (!validator) throw new Error(`No IPC validator registered for ${channel}`);

  ipcMain.on(channel, (event, payload) => {
    try {
      assertTrustedIpcSender(event, RENDERER_ROOT);
      const validatedPayload = validator(payload);
      event.returnValue = handler(event, validatedPayload);
    } catch (error) {
      mainLogger.warn('Synchronous IPC request rejected', {
        channel,
        sender: getIpcSenderUrl(event),
        senderWebContentsId: event?.sender?.id || null,
        senderWindowId: event?.sender ? BrowserWindow.fromWebContents(event.sender)?.id || null : null,
        error: error.message
      });
      event.returnValue = { success: false, error: 'Invalid or unauthorized IPC request' };
    }
  });
}

function toIpcSafeValue(value, seen = new WeakMap()) {
  if (value === null) return null;
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') return value;
  if (type === 'bigint') return value.toString();
  if (type === 'undefined' || type === 'function' || type === 'symbol') return undefined;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name || 'Error',
      message: value.message || '',
      code: value.code || ''
    };
  }
  if (Buffer.isBuffer?.(value)) return value.toString('base64');
  if (ArrayBuffer.isView(value)) return Array.from(value);
  if (value instanceof ArrayBuffer) return Array.from(new Uint8Array(value));
  if (seen.has(value)) return seen.get(value);

  if (Array.isArray(value)) {
    const output = [];
    seen.set(value, output);
    value.forEach(item => {
      const safeItem = toIpcSafeValue(item, seen);
      output.push(safeItem === undefined ? null : safeItem);
    });
    return output;
  }

  if (value instanceof Map) {
    const output = {};
    seen.set(value, output);
    for (const [key, item] of value.entries()) {
      const safeKey = String(key);
      const safeItem = toIpcSafeValue(item, seen);
      if (safeItem !== undefined) output[safeKey] = safeItem;
    }
    return output;
  }

  if (value instanceof Set) {
    const output = [];
    seen.set(value, output);
    for (const item of value.values()) {
      const safeItem = toIpcSafeValue(item, seen);
      output.push(safeItem === undefined ? null : safeItem);
    }
    return output;
  }

  const output = {};
  seen.set(value, output);
  for (const [key, item] of Object.entries(value)) {
    const safeItem = toIpcSafeValue(item, seen);
    if (safeItem !== undefined) output[key] = safeItem;
  }
  return output;
}

function buildPublicRuntimeConfig() {
  const publicConfig = { ...(runtimeConfig || {}) };
  delete publicConfig.desktopActions;
  return toIpcSafeValue(publicConfig);
}

function setupIPC() {
  if (ipcRegistered) {
    return;
  }
  registerIpcHandler('command:process', async (_event, { input, source }) => {
    if (!assistant) return { success: false, response: 'Assistant not initialized' };
    const result = await assistant.processCommand(input, source);
    if (result?.island) {
      showIslandItem(result.island);
    }
    if (
      result?.needsClarification &&
      result.data?.clarificationType === 'browser.open.blankTabAlreadyOpen' &&
      chatWindow &&
      !chatWindow.isDestroyed()
    ) {
      revealChatWindow();
    }
    if (source === 'voice') {
      relayVoiceConversationToChat(input, result);
    }
    return result;
  });

  registerIpcHandler('command:confirm', async (_event, { commandId, intentId, entities }) => {
    if (!assistant) return { success: false, response: 'Assistant not initialized' };
    return assistant.confirmAction(commandId, intentId, entities);
  });

  registerIpcHandler('assistant:status', async () => {
    if (!assistant) return { ready: false };
    return { ready: true, ...assistant.getStatus() };
  });

  registerIpcHandler('browser:openExternal', async (_event, { url }) => {
    await shell.openExternal(url);
    return { success: true, url };
  });

  registerIpcHandler('window:openChat', async () => {
    createChatWindow();
  });

  registerIpcHandler('window:hideChat', async () => {
    if (chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.hide();
    }
    return { success: true, visible: false };
  });

  registerIpcHandler('window:openVoice', async () => {
    return openVoiceWindow({ reason: 'renderer' });
  });

  registerIpcHandler('voice:close', async () => {
    return closeVoiceWindow();
  });

  registerIpcHandler('voice:getActivation', async () => {
    return consumePendingVoiceActivation();
  });

  registerIpcHandler('voice:getSettings', async () => {
    return settingsService.getSettings().voice;
  });

  registerIpcHandler('voice:updateSettings', async (_event, payload) => {
    const current = settingsService.getSettings().voice;
    const saved = settingsService.saveSettings({ voice: { ...current, ...payload } });
    runtimeConfig = settingsService.buildRuntimeConfig();
    registerVoiceShortcut();
    return saved.voice;
  });

  registerIpcHandler('voice:transcribe', async (_event, { samples }) => {
    const startedAt = Date.now();
    try {
      const text = await getVoiceModelLoader().transcribe(samples);
      mainLogger.info('[VOICE] Transcription completed', {
        durationMs: Date.now() - startedAt,
        samples: samples.length
      });
      return { success: true, text };
    } catch (error) {
      const failure = formatVoiceTranscriptionFailure(error);
      mainLogger.error('[VOICE] Transcription failed', {
        durationMs: Date.now() - startedAt,
        samples: samples.length,
        code: failure.code,
        error: error.message,
        details: error.details || null
      });
      return { success: false, text: '', ...failure };
    }
  });

  registerIpcHandler('window:openSettings', async () => {
    return createSettingsWindow();
  });

  registerIpcHandler('window:openPlanner', async (_event, { view }) => {
    createPlannerWindow(view, { lowerChat: true });
    return { success: true, view };
  });

  registerIpcHandler('window:closePlanner', async () => {
    if (plannerWindow && !plannerWindow.isDestroyed()) plannerWindow.close();
    return { success: true };
  });

  registerIpcHandler('config:get', async () => {
    return buildPublicRuntimeConfig();
  });

  registerIpcHandler('settings:get', async () => {
    const snapshot = buildSettingsSnapshot();
    return {
      ...snapshot,
      cloudStatus: cloudConnectionManager?.getStatus?.() || null,
      cloudPairingStatus: cloudPairingManager?.getStatus?.() || null,
      cloudCommandStatus: cloudCommandManager?.getStatus?.() || null
    };
  });

  registerIpcHandler('assistantChatHistory:get', async () => {
    const entries = readAssistantChatHistory();
    mainLogger.info('Assistant chat history loaded', { count: entries.length });
    return {
      success: true,
      count: entries.length,
      entries
    };
  });

  registerSyncIpcHandler('assistantChatHistory:getSync', () => {
    const entries = readAssistantChatHistory();
    return {
      success: true,
      count: entries.length,
      entries
    };
  });

  registerIpcHandler('assistantChatHistory:save', async (_event, payload) => {
    return writeAssistantChatHistory(payload?.entries || []);
  });

  registerSyncIpcHandler('assistantChatHistory:saveSync', (_event, payload) => {
    return writeAssistantChatHistory(payload?.entries || []);
  });

  registerIpcHandler('assistantChatHistory:clear', async () => {
    return clearAssistantChatHistory();
  });

  registerIpcHandler('remote:listTargets', async () => {
    return getRemoteControlTargets();
  });

  registerIpcHandler('remote:control', async (_event, payload) => {
    return sendRemoteControlAction(payload || {});
  });

  registerIpcHandler('homeOnboarding:snapshot', async () => {
    return initializeHomeOnboarding().getSnapshot();
  });

  registerIpcHandler('homeOnboarding:getBluetoothSelection', async () => {
    return {
      success: true,
      selection: lastHomeBluetoothSelection ? { ...lastHomeBluetoothSelection } : null
    };
  });

  registerIpcHandler('homeOnboarding:startDiscovery', async () => {
    const manager = initializeHomeOnboarding();
    const result = manager.startDiscovery();
    const serverRefresh = await manager.refreshServerDevices?.();
    const snapshot = manager.getSnapshot();
    mainLogger.info('[HOME] Home Device scan completed', {
      discoveryStarted: snapshot?.discovery?.discoveryStarted === true,
      devicesShown: Array.isArray(snapshot?.discovery?.devices) ? snapshot.discovery.devices.length : 0,
      serverDevicesAdded: Number(serverRefresh?.added || 0),
      serverRefreshStatus: serverRefresh?.success === false ? 'failed' : 'ok',
      serverRefreshCode: serverRefresh?.code || ''
    });
    sendHomeOnboardingStatus();
    return result;
  });

  registerIpcHandler('homeOnboarding:stopDiscovery', async () => {
    const result = initializeHomeOnboarding().stopDiscovery();
    sendHomeOnboardingStatus();
    return result;
  });

  registerIpcHandler('homeOnboarding:addDiscoveredDevice', async (_event, payload) => {
    const result = initializeHomeOnboarding().addDiscoveredDevice(payload || {});
    const logPayload = {
      deviceId: payload?.deviceId || '',
      deviceName: payload?.deviceName || payload?.name || '',
      transport: payload?.transport || '',
      discoverySource: payload?.discoverySource || payload?.source || '',
      success: result?.success !== false,
      duplicate: result?.duplicate === true,
      code: result?.code || ''
    };
    if (result?.success === false) {
      mainLogger.warn('[HOME] Home Device discovery item was rejected', logPayload);
    } else {
      mainLogger.info('[HOME] Home Device discovered', logPayload);
    }
    sendHomeOnboardingStatus();
    return result;
  });

  registerIpcHandler('homeOnboarding:start', async (_event, { deviceId }) => {
    const result = initializeHomeOnboarding().startOnboarding(deviceId);
    const logPayload = {
      deviceId,
      success: result?.success !== false,
      sessionId: result?.session?.sessionId || '',
      step: result?.session?.step || '',
      code: result?.code || ''
    };
    if (result?.success === false) {
      mainLogger.warn('[HOME] Home Device setup start failed', logPayload);
    } else {
      mainLogger.info('[HOME] Home Device setup started', logPayload);
    }
    sendHomeOnboardingStatus();
    return result;
  });

  registerIpcHandler('homeOnboarding:configure', async (_event, payload) => {
    const result = await initializeHomeOnboarding().sendConfiguration(payload || {});
    const logPayload = {
      sessionId: payload?.sessionId || '',
      serverAddress: payload?.serverAddress || '',
      ssidLength: String(payload?.ssid || '').length,
      success: result?.success !== false,
      step: result?.session?.step || '',
      code: result?.code || ''
    };
    if (result?.success === false) {
      mainLogger.warn('[HOME] Home Device configuration failed', logPayload);
    } else {
      mainLogger.info('[HOME] Home Device configuration recorded', logPayload);
    }
    sendHomeOnboardingStatus();
    return result;
  });

  registerIpcHandler('homeOnboarding:waitForConnection', async (_event, { sessionId }) => {
    const result = await initializeHomeOnboarding().waitForConnection(sessionId);
    const logPayload = {
      sessionId,
      deviceId: result?.session?.deviceId || result?.device?.deviceId || '',
      success: result?.success !== false,
      connectionStatus: result?.device?.connectionStatus || '',
      step: result?.session?.step || '',
      code: result?.code || ''
    };
    if (result?.success === false) {
      mainLogger.warn('[HOME] Home Device did not connect after configuration', logPayload);
    } else {
      mainLogger.info('[HOME] Home Device connected after configuration', logPayload);
    }
    sendHomeOnboardingStatus();
    return result;
  });

  registerIpcHandler('homeOnboarding:approve', async (_event, payload) => {
    const result = await initializeHomeOnboarding().approvePairing(payload || {});
    const logPayload = {
      sessionId: payload?.sessionId || '',
      ownerId: payload?.ownerId || '',
      deviceId: result?.session?.deviceId || result?.device?.deviceId || '',
      success: result?.success !== false,
      paired: result?.pairing?.paired === true,
      code: result?.code || ''
    };
    if (result?.success === false) {
      mainLogger.warn('[HOME] Home Device pairing approval failed', logPayload);
    } else {
      mainLogger.info('[HOME] Home Device pairing approved', logPayload);
    }
    sendHomeOnboardingStatus();
    return result;
  });

  registerIpcHandler('homeOnboarding:renameDevice', async (_event, { deviceId, ownerId, deviceName }) => {
    const result = await initializeHomeOnboarding().renameDevice(deviceId, ownerId, deviceName);
    const logPayload = { deviceId, success: result?.success !== false, code: result?.code || '' };
    if (result?.success === false) {
      mainLogger.warn('[HOME] Home Device rename failed', logPayload);
    } else {
      mainLogger.info('[HOME] Home Device renamed', logPayload);
    }
    sendHomeOnboardingStatus();
    return result;
  });

  registerIpcHandler('homeOnboarding:refreshDevice', async (_event, { deviceId }) => {
    const result = await initializeHomeOnboarding().refreshDevice(deviceId);
    const logPayload = {
      requestedDeviceId: deviceId || '',
      resolvedDeviceId: result?.device?.deviceId || '',
      success: result?.success !== false,
      connectionStatus: result?.device?.connectionStatus || '',
      pairingStatus: result?.device?.pairingStatus || result?.device?.pairStatus || '',
      migratedFrom: result?.migratedFrom || '',
      replacementDeviceId: result?.replacementDeviceId || '',
      reconnected: result?.reconnected === true,
      reclaimed: result?.reclaimed === true,
      code: result?.code || '',
      serverRefreshStatus: result?.serverRefreshStatus || '',
      serverRefreshCode: result?.serverRefreshCode || ''
    };
    if (result?.success === false) {
      mainLogger.warn('[HOME] Home Device reconnect check failed', logPayload);
    } else {
      mainLogger.info('[HOME] Home Device reconnect check completed', logPayload);
    }
    sendHomeOnboardingStatus();
    return result;
  });

  registerIpcHandler('homeOnboarding:removeDevice', async (_event, { deviceId, ownerId }) => {
    const result = await initializeHomeOnboarding().removeDevice(deviceId, ownerId);
    const logPayload = { deviceId, success: result?.success !== false, notified: result?.notified === true, code: result?.code || '' };
    if (result?.success === false) {
      mainLogger.warn('[HOME] Home Device removal failed', logPayload);
    } else {
      mainLogger.info('[HOME] Home Device removed', logPayload);
    }
    sendHomeOnboardingStatus();
    return result;
  });

  registerIpcHandler('homeOnboarding:finish', async (_event, { sessionId }) => {
    const result = initializeHomeOnboarding().finish(sessionId);
    sendHomeOnboardingStatus();
    return result;
  });

  registerIpcHandler('homeOnboarding:cancel', async (_event, { sessionId }) => {
    const result = initializeHomeOnboarding().cancel(sessionId);
    sendHomeOnboardingStatus();
    return result;
  });

  registerIpcHandler('uiState:get', async () => {
    return {
      success: true,
      state: readUiState()
    };
  });

  registerIpcHandler('uiState:save', async (_event, payload) => {
    return writeUiState(payload || {});
  });

  registerIpcHandler('security:status', async () => {
    return initializeSecurityLock().getStatus();
  });

  registerIpcHandler('security:verifyAccess', async (_event, { password }) => {
    return initializeSecurityLock().verify(password);
  });

  registerIpcHandler('security:setPassword', async (_event, payload) => {
    return initializeSecurityLock().setPassword(payload);
  });

  registerIpcHandler('cloud:status', async () => {
    const manager = initializeCloudConnection();
    manager.updateSettings(currentCloudSettings());
    return manager.getStatus();
  });

  registerIpcHandler('cloud:connect', async (_event, payload) => {
    const nextSettings = settingsService.saveSettings({
      cloud: {
        ...currentCloudSettings(),
        ...payload,
        enabled: true
      }
    }).cloud;
    runtimeConfig = settingsService.buildRuntimeConfig();
    const manager = initializeCloudConnection();
    manager.updateSettings(nextSettings);
    const status = await manager.connect(nextSettings);
    sendCloudStatus(status);
    initializeCloudPairing();
    initializeCloudCommands();
    sendCloudPairingStatus();
    if (chatWindow?.webContents) {
      chatWindow.webContents.send('settings:changed', {
        ...buildSettingsSnapshot(),
        cloudStatus: status,
        cloudPairingStatus: cloudPairingManager?.getStatus?.() || null
      });
    }
    return status;
  });

  registerIpcHandler('cloud:disconnect', async () => {
    const nextSettings = settingsService.saveSettings({
      cloud: {
        ...currentCloudSettings(),
        enabled: false
      }
    }).cloud;
    runtimeConfig = settingsService.buildRuntimeConfig();
    const manager = initializeCloudConnection();
    manager.updateSettings(nextSettings);
    const status = await manager.disconnect('manual-disconnect');
    sendCloudStatus(status);
    cloudPairingManager?.clearPairing?.('manual-disconnect');
    sendCloudPairingStatus();
    if (chatWindow?.webContents) {
      chatWindow.webContents.send('settings:changed', {
        ...buildSettingsSnapshot(),
        cloudStatus: status,
        cloudPairingStatus: cloudPairingManager?.getStatus?.() || null
      });
    }
    return status;
  });

  registerIpcHandler('cloud:pairingQR:create', async (_event, { password }) => {
    const verification = initializeSecurityLock().verify(password);
    if (verification.success !== true) return verification;
    const manager = initializeCloudPairing();
    const result = await manager.generatePairingQR({
      ttlMs: runtimeConfig?.cloud?.pairTokenTtlMs || 5 * 60 * 1000
    });
    sendCloudPairingStatus(manager.getStatus());
    return result;
  });

  registerIpcHandler('cloud:pairing:status', async () => {
    const manager = initializeCloudPairing();
    return manager.getStatus();
  });

  registerIpcHandler('cloud:pairing:approve', async (_event, { pairRequestId }) => {
    const result = initializeCloudPairing().approvePairing(pairRequestId);
    sendCloudPairingStatus();
    return result;
  });

  registerIpcHandler('cloud:pairing:reject', async (_event, { pairRequestId }) => {
    const result = initializeCloudPairing().rejectPairing(pairRequestId);
    sendCloudPairingStatus();
    return result;
  });

  registerIpcHandler('cloud:devices:list', async () => {
    return buildManagedDeviceList();
  });

  registerIpcHandler('cloud:device:rename', async (_event, { deviceId, deviceName }) => {
    const manager = initializeCloudConnection();
    const cloudDevice = manager.getStatus()?.pairedDevices?.find?.(device => device.deviceId === deviceId);
    if (!cloudDevice) return { success: false, message: 'Device not found.' };
    const result = await manager.updateDevice(deviceId, { friendlyName: deviceName, deviceName });
    sendCloudStatus(manager.getStatus());
    return { success: result?.success === true, device: result?.device || null };
  });

  registerIpcHandler('cloud:device:remove', async (_event, { deviceId }) => {
    const manager = initializeCloudConnection();
    const cloudDevice = manager.getStatus()?.pairedDevices?.find?.(device => device.deviceId === deviceId);
    if (!cloudDevice) return { success: false };
    const result = await manager.removeDevice(deviceId);
    sendCloudStatus(manager.getStatus());
    return { success: result?.success === true };
  });

  registerIpcHandler('settings:save', async (_event, payload) => {
    settingsService.saveSettings(payload);
    await reloadRuntimeServices();
    const manager = initializeCloudConnection();
    const cloudSettings = currentCloudSettings();
    manager.updateSettings(cloudSettings);
    if (cloudSettings.enabled !== true && manager.state !== 'Disconnected') {
      await manager.disconnect('cloud-disabled-in-settings');
    }
    broadcastProfileSync();
    broadcastModesSync();
    return {
      ...buildSettingsSnapshot(),
      cloudStatus: manager.getStatus()
    };
  });

  registerIpcHandler('settings:reset', async () => {
    settingsService.resetSettings();
    await reloadRuntimeServices();
    const manager = initializeCloudConnection();
    await manager.disconnect('settings-reset');
    manager.updateSettings(currentCloudSettings());
    broadcastModesSync();
    return {
      ...buildSettingsSnapshot(),
      cloudStatus: manager.getStatus()
    };
  });

  registerIpcHandler('schedule:alertAction', async (_event, { id, action, minutes }) => {
    const scheduler = assistant?.automation?.scheduler;
    const result = action === 'snooze'
      ? scheduler?.snooze(id, minutes)
      : (action === 'remove'
        ? scheduler?.removeSchedule?.(id)
        : scheduler?.complete(id));
    return result || { success: false, error: 'Scheduler unavailable' };
  });

  registerIpcHandler('island:stop', async (_event, payload) => {
    return runIslandScheduleAction(payload, 'stop');
  });

  registerIpcHandler('island:snooze', async (_event, payload) => {
    return runIslandScheduleAction(payload, 'snooze', payload.minutes || ISLAND_DEFAULT_SNOOZE_MINUTES);
  });

  registerIpcHandler('island:idle', async () => {
    return setIslandIdle();
  });

  registerIpcHandler('cloud:fileTransferAction', async (_event, { transferId, action }) => {
    const manager = initializeCloudFileTransfers();
    const transfer = manager?.incoming?.get?.(transferId);
    if (!transfer) {
      return { success: false, error: 'File transfer is no longer available.' };
    }
    const fileName = cloudTransferDisplayName(transfer);
    if (action === 'accept') {
      const accepted = manager.acceptTransfer(transferId);
      return {
        success: accepted,
        data: {
          fileName,
          status: accepted ? 'accepted' : 'failed',
          destination: getCloudReceivedDirectory()
        },
        error: accepted ? null : 'File transfer could not be accepted.'
      };
    }
    const rejected = manager.rejectTransfer(transferId, 'rejected-by-desktop');
    return {
      success: rejected,
      data: {
        fileName,
        status: rejected ? 'rejected' : 'failed'
      },
      error: rejected ? null : 'File transfer could not be rejected.'
    };
  });

  registerIpcHandler('schedule:getSnapshot', async () => getScheduleSyncSnapshot());

  registerIpcHandler('timerWidget:getState', async () => {
    return getTimerWidgetState(null, { includeStopwatch: timerWidgetMode === 'stopwatch' });
  });

  registerIpcHandler('timerWidget:close', async () => {
    hideTimerWidget();
    return { success: true };
  });

  registerIpcHandler('timerWidget:stopStopwatch', async () => {
    const result = assistant?.automation?.scheduler?.pauseStopwatch?.();
    if (result?.success) sendTimerWidgetState(getTimerWidgetState(result.data?.id || result.data?.taskName, { includeStopwatch: true }));
    return result || { success: false, error: 'Scheduler unavailable' };
  });

  registerIpcHandler('timerWidget:resumeStopwatch', async () => {
    const result = assistant?.automation?.scheduler?.resumeStopwatch?.();
    if (result?.success) {
      showTimerWidget(result.data?.id || result.data?.taskName, { includeStopwatch: true });
    }
    return result || { success: false, error: 'Scheduler unavailable' };
  });

  registerIpcHandler('timerWidget:resetStopwatch', async () => {
    const result = assistant?.automation?.scheduler?.resetStopwatch?.();
    if (result?.success) {
      showTimerWidget(result.data?.id || result.data?.taskName, { includeStopwatch: true });
    }
    return result || { success: false, error: 'Scheduler unavailable' };
  });

  registerIpcHandler('planner:getEntries', async () => {
    if (!assistant?.automation?.planner) return { success: false, error: 'Planner unavailable' };
    const entries = getPlannerEntriesForRenderer();
    return { success: true, data: { entries, count: entries.length } };
  });

  registerIpcHandler('planner:addEntry', async (_event, payload) => {
    const result = assistant?.automation?.planner?.addEntry?.(payload) || { success: false, error: 'Planner unavailable' };
    if (result?.success) sendPlannerEntries(payload.type);
    return result;
  });

  registerIpcHandler('planner:deleteEntry', async (_event, { id }) => {
    const result = assistant?.automation?.planner?.deleteEntry?.(id) || { success: false, error: 'Planner unavailable' };
    if (result?.success) sendPlannerEntries();
    return result;
  });

  registerIpcHandler('app:quit', async () => {
    app.quit();
  });

  ipcRegistered = true;
}

function teardownIPC() {
  for (const channel of IPC_CHANNELS) {
    try {
      ipcMain.removeHandler(channel);
    } catch (error) {
      mainLogger.error('Failed to remove IPC handler', { channel, error: error.message });
    }
    ipcMain.removeAllListeners(channel);
  }
  ipcRegistered = false;
}

async function destroyAssistantInstance() {
  if (!assistant) return;
  const currentAssistant = assistant;
  assistant = null;
  try {
    await currentAssistant.destroy?.();
  } catch (error) {
    mainLogger.error('Assistant cleanup failed', { error: error.message });
  }
}

async function cleanupRuntime() {
  if (cleanupPromise) {
    return cleanupPromise;
  }

  cleanupPromise = (async () => {
    if (stableRuntimeHandle) {
      clearTimeout(stableRuntimeHandle);
      stableRuntimeHandle = null;
    }
    if (openXTempCleanupTimer) {
      clearTimeout(openXTempCleanupTimer);
      openXTempCleanupTimer = null;
    }
    for (const timeout of recoveryTimeouts) clearTimeout(timeout);
    recoveryTimeouts.clear();
    for (const timeout of unresponsiveTimeouts.values()) clearTimeout(timeout);
    unresponsiveTimeouts.clear();
    unregisterChatShortcut();
    unregisterVoiceShortcut();
    if (voiceWarmupTimer) {
      clearTimeout(voiceWarmupTimer);
      voiceWarmupTimer = null;
    }
    globalShortcut.unregisterAll();
    childProcessRegistry.killAll();
    teardownIPC();
    securityLockService = null;
    if (cloudFileTransferManager) {
      try {
        cloudFileTransferManager.destroy();
      } catch (error) {
        mainLogger.error('[CLOUD-FILE] Cleanup failed', { error: error.message });
      } finally {
        cloudFileTransferManager = null;
      }
    }
    if (cloudCommandManager) {
      try {
        cloudCommandManager.destroy();
      } catch (error) {
        mainLogger.error('[CLOUD] Command cleanup failed', { error: error.message });
      } finally {
        cloudCommandManager = null;
      }
    }
    if (cloudPairingManager) {
      try {
        cloudPairingManager.destroy();
      } catch (error) {
        mainLogger.error('[CLOUD] Pairing cleanup failed', { error: error.message });
      } finally {
        cloudPairingManager = null;
      }
    }
    if (cloudConnectionManager) {
      try {
        await cloudConnectionManager.destroy('runtime-cleanup');
      } catch (error) {
        mainLogger.error('[CLOUD] Cleanup failed', { error: error.message });
      } finally {
        cloudConnectionManager = null;
      }
    }
    if (homeOnboardingManager) {
      try {
        homeOnboardingManager.stopDiscovery();
      } catch (error) {
        mainLogger.error('[HOME] Onboarding cleanup failed', { error: error.message });
      } finally {
        homeOnboardingManager = null;
      }
    }
    await destroyAssistantInstance();
    eventBus?.removeAllListeners?.();
    if (chatWindow && !chatWindow.isDestroyed()) chatWindow.destroy();
    if (voiceWindow && !voiceWindow.isDestroyed()) voiceWindow.destroy();
    if (islandWindow && !islandWindow.isDestroyed()) islandWindow.destroy();
    if (timerWidgetWindow && !timerWidgetWindow.isDestroyed()) timerWidgetWindow.destroy();
    if (plannerWindow && !plannerWindow.isDestroyed()) plannerWindow.destroy();
    if (tray) {
      tray.destroy();
      tray = null;
    }
    cleanupFinished = true;
  })();

  return cleanupPromise;
}

function unregisterChatShortcut() {
  if (registeredChatShortcuts.length === 0) {
    return;
  }

  for (const shortcut of registeredChatShortcuts) {
    try {
      globalShortcut.unregister(shortcut);
    } catch (error) {
      mainLogger.error('Failed to unregister chat shortcut', { shortcut, error: error.message });
    }
  }
  registeredChatShortcuts = [];
}

function getChatShortcuts() {
  const primary = runtimeConfig?.chat?.activationShortcut || BASE_CONFIG.chat.activationShortcut || 'Control+Space';
  const fallbacks = runtimeConfig?.chat?.activationFallbackShortcuts
    || BASE_CONFIG.chat.activationFallbackShortcuts
    || [];

  return [...new Set([primary, ...fallbacks].filter(Boolean))]
    .filter(shortcut => shortcut !== 'Alt+Space');
}

function toggleChatFromShortcut(shortcut = '') {
  if (chatWindow && !chatWindow.isDestroyed() && chatWindow.isVisible()) {
    chatWindow.hide();
    mainLogger.info('Chat shortcut closed chat', { shortcut });
    return { success: true, visible: false };
  }
  createChatWindow();
  mainLogger.info('Chat shortcut opened chat', { shortcut });
  return { success: true, visible: true };
}

function registerChatShortcut() {
  unregisterChatShortcut();

  for (const shortcut of getChatShortcuts()) {
    try {
      const registered = globalShortcut.register(shortcut, () => {
        mainLogger.info('Chat shortcut pressed', { shortcut });
        toggleChatFromShortcut(shortcut);
      });

      if (!registered) {
        mainLogger.error('Failed to register chat shortcut', { shortcut });
        continue;
      }

      registeredChatShortcuts.push(shortcut);
      mainLogger.info('Registered chat shortcut', { shortcut });
    } catch (error) {
      mainLogger.error('Invalid chat shortcut', { shortcut, error: error.message });
    }
  }

}

function unregisterVoiceShortcut() {
  if (registeredVoiceShortcuts.length === 0) {
    return;
  }

  for (const shortcut of registeredVoiceShortcuts) {
    try {
      globalShortcut.unregister(shortcut);
    } catch (error) {
      mainLogger.error('Failed to unregister voice shortcut', { shortcut, error: error.message });
    }
  }
  registeredVoiceShortcuts = [];
}

function getVoiceShortcut() {
  return runtimeConfig?.voice?.activationShortcut || BASE_CONFIG.voice?.activationShortcut || 'Alt+Space';
}

function registerVoiceShortcut() {
  unregisterVoiceShortcut();
  const shortcut = getVoiceShortcut();
  if (!shortcut) return;
  try {
    const registered = globalShortcut.register(shortcut, () => {
      mainLogger.info('[VOICE] Voice shortcut pressed', { shortcut });
      openVoiceWindow({ reason: 'shortcut' });
    });
    if (!registered) {
      mainLogger.error('[VOICE] Failed to register voice shortcut', { shortcut });
      return;
    }
    registeredVoiceShortcuts.push(shortcut);
    mainLogger.info('[VOICE] Registered voice shortcut', { shortcut });
  } catch (error) {
    mainLogger.error('[VOICE] Invalid voice shortcut', { shortcut, error: error.message });
  }
}

async function initializeAssistant() {
  ensureDataDir();
  runtimeConfig = settingsService.buildRuntimeConfig();
  assistant = new Assistant(runtimeConfig, { eventBus });
  await assistant.automation.init();
  assistant.router.permissionValidator.setUserLevel(
    settingsService.getSettings().system.permissionLevel
  );

  registerChatShortcut();
  registerVoiceShortcut();
  scheduleVoiceWarmup('assistant-ready');
  mainLogger.info('Assistant initialized', {
    name: runtimeConfig?.assistant?.displayName || 'OpenX'
  });
  if (runtimeConfig?.localLlm?.warmupOnStartup === true && typeof assistant.warmupLocalLlm === 'function') {
    assistant.warmupLocalLlm('assistant-ready').catch(error => {
      mainLogger.warn('[LLM] Local LLM warmup failed', error?.message || error);
    });
  }
}

function initializeCloudMobileRuntime() {
  initializeSecurityLock();
  const cloudTransfers = initializeCloudFileTransfers();
  const manager = initializeCloudConnection();
  if (!cloudProfileSyncRegistered) {
    manager.on('relay-packet', handleCloudProfileSyncPacket);
    cloudProfileSyncRegistered = true;
  }
  if (!cloudModesSyncRegistered) {
    manager.on('relay-packet', handleCloudModesSyncPacket);
    cloudModesSyncRegistered = true;
  }
  if (assistant?.automation) {
    assistant.automation.fileTransferManager = cloudTransfers;
  }
}

async function reloadRuntimeServices() {
  runtimeConfig = settingsService.buildRuntimeConfig();

  await destroyAssistantInstance();
  await initializeAssistant();

  if (tray) {
    tray.setToolTip(`${runtimeConfig?.assistant?.displayName || 'OpenX'} Assistant`);
  }

  if (chatWindow?.webContents) {
    chatWindow.webContents.send('settings:changed', buildSettingsSnapshot());
  }
}

function registerPowerRecoveryHandlers() {
  if (powerRecoveryHandlersRegistered || !powerMonitor || typeof powerMonitor.on !== 'function') return;
  powerRecoveryHandlersRegistered = true;

}

function normalizeError(reason) {
  if (reason instanceof Error) return reason;
  if (typeof reason === 'string') return new Error(reason);
  try {
    return new Error(JSON.stringify(reason));
  } catch (_) {
    return new Error(String(reason));
  }
}

function buildCrashRecoveryMetadata(origin, error, component = 'main-process') {
  return {
    origin,
    reason: error?.message || String(error || 'Unknown crash'),
    component,
    pid: process.pid,
    uptimeMs: Math.round(process.uptime() * 1000),
    memory: process.memoryUsage?.() || null,
    assistantInitialized: Boolean(assistant),
    windows: {
      chat: Boolean(chatWindow && !chatWindow.isDestroyed()),
      planner: Boolean(plannerWindow && !plannerWindow.isDestroyed()),
      timer: Boolean(timerWidgetWindow && !timerWidgetWindow.isDestroyed())
    }
  };
}

function waitForTimeout(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function exitRuntime(code) {
  if (app?.exit) {
    app.exit(code);
    return;
  }
  process.exit(code);
}

function handleFatalError(reason, origin) {
  const error = normalizeError(reason);
  Logger.writeCrashSync(error, {
    type: 'main-process',
    origin,
    platform: process.platform,
    release: os.release(),
    electron: process.versions.electron,
    node: process.versions.node
  }, BASE_CONFIG.logging);

  if (fatalErrorHandling) return;
  fatalErrorHandling = true;
  mainLogger.error('Fatal main-process error', { origin, error: error.message });

  if (app?.isReady?.() && !cleanupFinished) {
    try {
      const recoveryMetadata = buildCrashRecoveryMetadata(origin, error, 'main-process');
      if (crashRecoveryPolicy.requestRestart(Date.now(), recoveryMetadata)) {
        app.relaunch();
      } else {
        mainLogger.error('Automatic relaunch blocked by crash-loop policy', crashRecoveryPolicy.getDiagnostics());
      }
    } catch (relaunchError) {
      mainLogger.error('Failed to schedule application relaunch', { error: relaunchError.message });
    }
  }

  Promise.race([
    cleanupRuntime(),
    waitForTimeout(FATAL_CLEANUP_TIMEOUT_MS)
  ]).catch(error => {
    mainLogger.error('Fatal cleanup failed', { error: error.message });
  }).finally(() => exitRuntime(1));
}

function handleSignal(signal) {
  if (signalHandling || fatalErrorHandling) return;
  signalHandling = true;
  mainLogger.info('Termination signal received', { signal });
  Promise.race([
    cleanupRuntime(),
    waitForTimeout(FATAL_CLEANUP_TIMEOUT_MS)
  ]).catch(error => {
    mainLogger.error('Signal cleanup failed', { error: error.message });
  }).finally(() => exitRuntime(0));
}

process.on('uncaughtException', error => handleFatalError(error, 'uncaughtException'));
process.on('unhandledRejection', reason => handleFatalError(reason, 'unhandledRejection'));
process.on('SIGINT', () => handleSignal('SIGINT'));
process.on('SIGTERM', () => handleSignal('SIGTERM'));

app.on('child-process-gone', (_event, details) => {
  if (details.reason === 'clean-exit' || cleanupFinished || cleanupPromise) return;
  const error = new Error(`${details.type || 'Electron child'} process exited: ${details.reason}`);
  Logger.writeCrashSync(error, { type: 'child-process', details }, BASE_CONFIG.logging);
  mainLogger.error('Electron child process exited unexpectedly', { details });
});

app.whenReady().then(async () => {
  disableSpellChecker();
  configureSessionSecurity();
  settingsService = new SettingsService(BASE_CONFIG);
  runtimeConfig = settingsService.buildRuntimeConfig();
  eventBus = new AssistantEventBus();
  eventBus.subscribe(EVENTS.SCHEDULE_DUE, envelope => {
    showIslandItem(buildScheduleIslandItem(envelope.payload));
    sendPlannerEntries('calendar');
    sendScheduleActivitySnapshot('schedule-due');
  });
  eventBus.subscribe(EVENTS.SCHEDULE_CHANGED, envelope => {
    sendPlannerEntries('calendar');
    sendScheduleActivitySnapshot('schedule-changed');
    broadcastScheduleSync(envelope.payload);
  });
  eventBus.subscribe(EVENTS.COMMAND_EXECUTED, envelope => handleTimerWidgetCommand(envelope.payload));
  eventBus.subscribe(EVENTS.COMMAND_EXECUTED, envelope => handlePlannerCommand(envelope.payload));
  setupIPC();
  initIslandWindow();
  registerPowerRecoveryHandlers();
  createTray();
  await initializeAssistant();
  initializeCloudConnection();
  initializeCloudPairing();
  initializeCloudCommands();
  initializeCloudMobileRuntime();
  initializeHomeOnboarding();
  wireHomeAutomationExecution();
  await maybeAutoConnectCloud('desktop-startup');
  if (!app.isPackaged) {
    createChatWindow();
  }
  stableRuntimeHandle = setTimeout(() => {
    stableRuntimeHandle = null;
    try {
      crashRecoveryPolicy.markStable();
      mainLogger.info('Crash recovery budget reset after stable runtime');
    } catch (error) {
      mainLogger.warn('Failed to reset crash recovery budget', { error: error.message });
    }
  }, STABLE_RUNTIME_MS);
  mainLogger.info('Desktop runtime ready', {
    version: app.getVersion(),
    platform: process.platform,
    release: os.release()
  });
  scheduleOpenXTempCleanup('desktop-runtime-ready');
}).catch(error => handleFatalError(error, 'startup'));

app.on('window-all-closed', () => {
  // Keep running in tray so the tray menu can reopen chat.
});

app.on('activate', () => {
  createChatWindow();
});

app.on('before-quit', (event) => {
  if (cleanupFinished) {
    return;
  }

  event.preventDefault();
  if (!fatalErrorHandling) {
    try {
      crashRecoveryPolicy.markStable();
    } catch (error) {
      mainLogger.warn('Failed to clear crash recovery state during shutdown', { error: error.message });
    }
  }
  cleanupRuntime()
    .catch(error => {
      mainLogger.error('Runtime cleanup failed', { error: error.message });
    })
    .finally(() => {
      cleanupFinished = true;
      app.quit();
    });
});

app.on('will-quit', () => {
  if (!cleanupFinished) {
    globalShortcut.unregisterAll();
    childProcessRegistry.killAll();
  }
});
