const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, globalShortcut, session, screen, powerMonitor, safeStorage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const WebSocket = require('ws');

const BASE_CONFIG = require('../../../config');
const Assistant = require('../../../core/assistant/index');
const TextToSpeech = require('../voice/tts');
const { VoiceTheme } = require('../voice/ui');
const VOICE_INTEGRATION_EVENTS = require('../voice/integration/VoiceIntegrationEvents');
const {
  VoiceSessionManager,
  VoiceAssistantBridge,
  DiagnosticsManager,
  VoiceOverlay,
  VoiceWindowController,
  AudioCapture,
  AudioDeviceManager,
  AudioPermissions,
  STTEngine,
  STTConfiguration,
  SESSION_EVENTS
} = require('../voice');
const { SettingsService } = require('../settings');
const { AssistantEventBus, EVENTS, Logger } = require('../../../core/assistant/Data');
const {
  ensureDataRoot,
  legacyQuarantinePath,
  migrateLegacyData,
  moveDirectoryIntoManagedData,
  readJsonFile,
  writeJsonAtomic
} = require('../../../core/assistant/Data');
const { VisualMemoryEngine } = require('../../../core/assistant/capabilities/visual-memory');
const { ConversationManager } = require('../../../core/chat/conversations');
const { CryptoManager } = require('../../../core/chat/crypto');
const { MessageManager } = require('../../../core/chat/messages');
const { ChatRuntimeStateMachine } = require('../../../core/chat/state');
const { CloudCommandManager, CloudConnectionManager, CloudFileTransferManager, CloudLogger, CloudPairingManager } = require('../../../core/cloud');
const CrashRecoveryPolicy = require('./crash-recovery');
const OpenXSecurityLock = require('../security-lock');
const {
  IPC_VALIDATORS,
  assertTrustedIpcSender,
  createSecureWebPreferences,
  getIpcSenderUrl,
  isPlainObject,
  isTrustedRendererUrl
} = require('./security');

const RENDERER_ROOT = path.resolve(__dirname, '..', 'renderer');
const VOICE_CAPTURE_FILE = path.join(RENDERER_ROOT, 'voice-capture', 'index.html');
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
const REQUIRED_PARAKEET_MODEL_FILES = Object.freeze([
  'encoder.int8.onnx',
  'decoder.int8.onnx',
  'joiner.int8.onnx',
  'tokens.txt'
]);
const TEMP_CLEANUP_STARTUP_DELAY_MS = 12 * 1000;
const TEMP_CLEANUP_MAX_SCAN_ENTRIES = 1000;
const TEMP_CLEANUP_MAX_DELETE_ENTRIES = 128;
const TEMP_CLEANUP_CONCURRENCY = 4;

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
let timerWidgetWindow = null;
let timerWidgetMode = null;
let plannerWindow = null;
let galleryWindow = null;
let tray = null;
let assistant = null;
let visualMemoryEngine = null;
let visualMemoryDefaultFoldersReady = false;
let visualMemoryIndexPromise = null;
let lazyVisualMemoryApi = null;
let visualMemoryReadyLogged = false;
let voiceSessionManager = null;
let voiceAssistantBridge = null;
let diagnosticsManager = null;
let voiceOverlay = null;
let voiceCaptureWindow = null;
let voiceCaptureReady = false;
let voiceCaptureShouldRun = false;
let voiceCaptureRunId = 0;
let voiceCaptureStartOptions = null;
let voiceCaptureFrameReceiver = null;
let voiceCaptureWarmupTimer = null;
let voiceResourceWarmupTimer = null;
let voiceResumeRecoveryTimer = null;
let liveScheduleCollapseTimer = null;
let activeLiveSchedulePayload = null;
let voiceModelSummaryLogged = false;
let voiceModelLoadingLogged = false;
let voiceTtsSummary = null;
let voiceSttSummary = null;
let voiceStartInFlight = false;
let voiceLastStartAt = 0;
let voiceSpeakingStopTapAt = 0;
let voiceSpeakingStopSessionId = null;
let voiceMediaQuietingState = null;
let powerRecoveryHandlersRegistered = false;
let voiceCaptureFrameStats = {
  received: 0,
  delivered: 0,
  dropped: 0,
  bytes: 0,
  lastLogAt: 0
};
let textToSpeech = null;
let settingsService = null;
let runtimeConfig = null;
let eventBus = null;
let registeredChatShortcuts = [];
let ipcRegistered = false;
let voiceCaptureIpcRegistered = false;
let cleanupFinished = false;
let cleanupPromise = null;
let fatalErrorHandling = false;
let signalHandling = false;
let stableRuntimeHandle = null;
let chatLoweredForPlanner = false;
let securityLockService = null;
let desktopChatConversationManager = null;
let desktopChatConversationReady = null;
let desktopChatMessageManager = null;
let desktopChatMessageReady = null;
let desktopChatMessageApiBaseUrl = '';
let desktopChatCryptoManager = null;
let desktopChatCryptoReady = null;
let desktopChatSocket = null;
let desktopChatSocketContext = null;
let desktopChatReconnectTimer = null;
let desktopChatSyncTimer = null;
let desktopChatSyncInFlight = false;
let desktopChatSyncFailureCount = 0;
let desktopChatSyncIdleCount = 0;
let desktopChatUiState = {
  visible: false,
  activeConversationId: '',
  threadOpen: false,
  updatedAt: 0
};
let cloudConnectionManager = null;
let cloudPairingManager = null;
let cloudCommandManager = null;
let cloudFileTransferManager = null;
let cloudProfileSyncRegistered = false;
let cloudModesSyncRegistered = false;
const cloudFileTransferUiProgress = new Map();
const rendererCrashHistory = new Map();
const recoveryTimeouts = new Set();
const unresponsiveTimeouts = new Map();
const VOICE_SHORTCUT_DEBOUNCE_MS = 450;
const VOICE_ACTIVE_CANCEL_GRACE_MS = 650;
const VOICE_SPEAKING_DOUBLE_TAP_MS = 1400;
const VOICE_IDLE_RUNTIME_PREWARM_DELAY_MS = 15 * 1000;
const VOICE_IDLE_RESOURCE_WARMUP_DELAY_MS = 45 * 1000;
const VOICE_RESUME_RUNTIME_PREWARM_DELAY_MS = 1200;
const VOICE_RESUME_RESOURCE_WARMUP_DELAY_MS = 2500;
const LIVE_SCHEDULE_INITIAL_EXPAND_MS = 5000;
const DEFAULT_CHAT_API_BASE_URL = 'https://openx-chat-server.onrender.com';
const LEGACY_CHAT_API_BASE_URLS = new Set([
  'http://localhost:8090',
  'http://127.0.0.1:8090'
]);
const DESKTOP_CHAT_SETUP_VERSION = 2;
const DESKTOP_CHAT_REQUEST_TIMEOUT_MS = 15000;
const DESKTOP_CHAT_SYNC_REQUEST_TIMEOUT_MS = 8000;
const DESKTOP_CHAT_LOOPBACK_RETRY_LOG_WINDOW_MS = 30000;
const DESKTOP_CHAT_SYNC_INTERVAL_MS = 15000;
const DESKTOP_CHAT_SYNC_ACTIVE_INTERVAL_MS = 5000;
const DESKTOP_CHAT_SYNC_IDLE_MAX_MS = 60000;
const DESKTOP_CHAT_SYNC_FAILURE_MAX_MS = 120000;
const DESKTOP_CHAT_SYNC_OVERLAP = 50;
const DESKTOP_CHAT_RECONNECT_MIN_MS = 1500;
const DESKTOP_CHAT_RECONNECT_MAX_MS = 30000;
const DESKTOP_CHAT_NOTIFICATION_PREVIEW_MAX = 360;
const DESKTOP_CHAT_SEEN_INCOMING_LIMIT = 300;
const DESKTOP_CHAT_LOCAL_HISTORY_LIMIT = 300;
const desktopChatLoopbackRetryLogState = {
  lastAt: 0,
  suppressed: 0
};
const desktopChatOfflineInfoLogState = {
  lastAt: 0,
  suppressed: 0
};
const desktopChatSeenIncomingMessages = new Map();
const IPC_CHANNELS = [
  'command:process',
  'command:confirm',
  'assistant:status',
  'tts:speak',
  'tts:stop',
  'browser:openExternal',
  'voice:start',
  'voiceOverlay:collapse',
  'voiceOverlay:expandLiveSchedule',
  'window:openChat',
  'window:hideChat',
  'window:openPeopleChat',
  'window:openSettings',
  'window:openPlanner',
  'window:closePlanner',
  'window:openGallery',
  'window:closeGallery',
  'config:get',
  'settings:get',
  'assistantChatHistory:get',
  'assistantChatHistory:getSync',
  'assistantChatHistory:save',
  'assistantChatHistory:saveSync',
  'assistantChatHistory:clear',
  'desktopChat:list',
  'desktopChat:open',
  'desktopChat:create',
  'desktopChat:update',
  'desktopChat:delete',
  'desktopChat:send',
  'desktopChat:quickReply',
  'desktopChat:contacts:list',
  'desktopChat:contacts:accept',
  'desktopChat:contacts:delete',
  'desktopChat:contacts:cancel',
  'desktopChat:registration:get',
  'desktopChat:registration:start',
  'desktopChat:profile:password',
  'desktopChat:uiState',
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
  'gallery:getView',
  'gallery:getPhotos',
  'gallery:getImageData',
  'gallery:openPhoto',
  'gallery:showPhoto',
  'gallery:toggleFavorite',
  'gallery:nameFace',
  'gallery:setFaceRelationship',
  'gallery:updateFacePerson',
  'gallery:deleteFacePerson',
  'gallery:addFaceToPerson',
  'gallery:removeFaceCluster',
  'gallery:scanPeople',
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

function isVoiceCaptureRendererUrl(url) {
  if (!isTrustedRendererUrl(url, RENDERER_ROOT)) return false;
  try {
    const { fileURLToPath } = require('url');
    return path.resolve(fileURLToPath(url)) === path.resolve(VOICE_CAPTURE_FILE);
  } catch (_) {
    return false;
  }
}

function canGrantVoiceCapturePermission(webContents, permission, candidateUrl = '') {
  if (!['media', 'microphone'].includes(String(permission || ''))) return false;
  const contentsUrl = webContents?.getURL?.() || '';
  return isVoiceCaptureRendererUrl(candidateUrl) || isVoiceCaptureRendererUrl(contentsUrl);
}

function configureSessionSecurity() {
  try {
    const defaultSession = session.defaultSession;
    defaultSession?.setPermissionRequestHandler?.((webContents, permission, callback, details) => {
      const requestingUrl = details?.requestingUrl || webContents?.getURL?.() || '';
      if (canGrantVoiceCapturePermission(webContents, permission, requestingUrl)) {
        mainLogger.info('Allowed voice capture microphone permission', { permission, requestingUrl });
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
      if (canGrantVoiceCapturePermission(webContents, permission, requestingOrigin)) {
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

function scheduleRendererRecovery(windowType, createWindow) {
  if (cleanupFinished || cleanupPromise) {
    mainLogger.info('Skipped renderer recovery during shutdown', { windowType });
    return;
  }

  const budget = consumeRendererRestartBudget(windowType);
  if (!budget.allowed) {
    mainLogger.error('Renderer recovery budget exhausted', { windowType });
    return;
  }

  const delayMs = Math.min(
    MAX_RENDERER_RECOVERY_DELAY_MS,
    RENDERER_RESTART_DELAY_MS * Math.max(1, budget.crashCount)
  );
  const timeout = setTimeout(() => {
    recoveryTimeouts.delete(timeout);
    if (!cleanupFinished && !cleanupPromise) createWindow();
  }, delayMs);
  recoveryTimeouts.add(timeout);
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
      scheduleRendererRecovery(`${windowType}:load`, createWindow);
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
      scheduleRendererRecovery(`${windowType}:preload`, createWindow);
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
    scheduleRendererRecovery(windowType, createWindow);
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
        mainLogger.warn('Reloading unresponsive renderer', { windowType });
        browserWindow.webContents.reloadIgnoringCache();
      }
    }, UNRESPONSIVE_RELOAD_DELAY_MS);
    unresponsiveTimeouts.set(browserWindow, timeout);
  });

  browserWindow.on('responsive', () => {
    clearUnresponsiveTimeout(browserWindow);
  });

  browserWindow.on('closed', () => {
    clearUnresponsiveTimeout(browserWindow);
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
    webPreferences: createSecureWebPreferences(PRELOAD_PATH)
  });

  const chatFile = path.join(RENDERER_ROOT, 'chat', 'index.html');
  secureWindow(chatWindow, {
    windowType: 'chat',
    expectedFile: chatFile,
    createWindow: createChatWindow
  });
  chatWindow.loadFile(chatFile).catch(error => {
    mainLogger.error('Failed to load chat renderer', { error: error.message });
  });

  chatWindow.on('closed', () => {
    chatWindow = null;
  });

  if (process.argv.includes('--dev')) {
    chatWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function sendVoiceCaptureCommand(channel, payload = {}) {
  if (!voiceCaptureWindow || voiceCaptureWindow.isDestroyed() || !voiceCaptureReady) return false;
  voiceCaptureWindow.webContents.send(channel, payload);
  return true;
}

function startVoiceCaptureStream(options = {}) {
  voiceCaptureRunId += 1;
  voiceCaptureShouldRun = true;
  voiceCaptureStartOptions = {
    sampleRate: options.sampleRate || 16000,
    channels: options.channels || 1,
    runId: voiceCaptureRunId
  };
  createVoiceCaptureWindow();
  const sent = sendVoiceCaptureCommand('voiceCapture:start', voiceCaptureStartOptions);
  mainLogger.info('Voice microphone capture requested', { sent, runId: voiceCaptureRunId });
}

function stopVoiceCaptureStream(reason = 'stop') {
  if (!voiceCaptureShouldRun && !voiceCaptureStartOptions) {
    mainLogger.info('Voice microphone capture stop skipped because capture is already stopped', { reason, runId: voiceCaptureRunId });
    return false;
  }
  voiceCaptureRunId += 1;
  voiceCaptureShouldRun = false;
  voiceCaptureStartOptions = null;
  voiceCaptureFrameReceiver = null;
  const sent = sendVoiceCaptureCommand('voiceCapture:stop', { reason, runId: voiceCaptureRunId });
  mainLogger.info('Voice microphone capture stop requested', { sent, reason, runId: voiceCaptureRunId });
  return sent;
}

function resetVoiceCaptureFrameStats() {
  voiceCaptureFrameStats = {
    received: 0,
    delivered: 0,
    dropped: 0,
    bytes: 0,
    lastLogAt: Date.now()
  };
}

function shouldLogVoiceFrameProgress() {
  const now = Date.now();
  if (voiceCaptureFrameStats.delivered <= 1) return true;
  if (voiceCaptureFrameStats.delivered % 50 === 0) return true;
  if (now - voiceCaptureFrameStats.lastLogAt >= 2500) return true;
  return false;
}

function normalizeVoiceCaptureFrame(payload = {}) {
  if (!isPlainObject(payload)) throw new TypeError('voice frame must be an object');
  const sampleRate = Math.max(8000, Math.min(48000, Number(payload.sampleRate) || 16000));
  const channels = Math.max(1, Math.min(2, Number(payload.channels) || 1));
  const bitDepth = Number(payload.bitDepth) === 16 ? 16 : 16;
  const frameIndex = Math.max(0, Number(payload.frameIndex) || 0);
  const sampleCount = Math.max(1, Math.min(4800, Number(payload.sampleCount) || 320));
  const durationMs = Math.max(1, Math.min(250, Number(payload.durationMs) || ((sampleCount / sampleRate) * 1000)));
  const pcmInput = payload.pcm;
  let pcm = null;
  if (Buffer.isBuffer(pcmInput)) {
    pcm = Buffer.from(pcmInput);
  } else if (pcmInput instanceof Uint8Array) {
    pcm = Buffer.from(pcmInput);
  } else if (Array.isArray(pcmInput)) {
    pcm = Buffer.from(pcmInput);
  } else if (pcmInput instanceof ArrayBuffer) {
    pcm = Buffer.from(new Uint8Array(pcmInput));
  }
  if (!pcm || pcm.length === 0) throw new TypeError('voice frame pcm is empty');
  if (pcm.length > 9600) throw new RangeError('voice frame pcm is too large');
  return {
    frameIndex,
    timestamp: payload.timestamp || new Date().toISOString(),
    pcm,
    sampleRate,
    channels,
    bitDepth,
    sampleCount,
    durationMs,
    deviceId: 'desktop-default-microphone',
    runId: Math.max(0, Number(payload.runId) || 0),
    rms: Math.max(0, Math.min(1, Number(payload.rms) || 0))
  };
}

function receiveVoiceCaptureFrame(payload = {}) {
  voiceCaptureFrameStats.received += 1;
  let frame;
  try {
    frame = normalizeVoiceCaptureFrame(payload);
  } catch (error) {
    voiceCaptureFrameStats.dropped += 1;
    if (voiceCaptureFrameStats.dropped <= 3 || voiceCaptureFrameStats.dropped % 25 === 0) {
      mainLogger.warn('Voice PCM frame rejected', { error: error.message, dropped: voiceCaptureFrameStats.dropped });
    }
    return;
  }

  if (!voiceCaptureShouldRun || frame.runId !== voiceCaptureRunId) {
    voiceCaptureFrameStats.dropped += 1;
    return;
  }

  if (typeof voiceCaptureFrameReceiver !== 'function') {
    voiceCaptureFrameStats.dropped += 1;
    if (voiceCaptureFrameStats.dropped <= 3 || voiceCaptureFrameStats.dropped % 25 === 0) {
      mainLogger.warn('Voice PCM frame dropped because AudioCapture is not ready', {
        frameIndex: frame.frameIndex,
        dropped: voiceCaptureFrameStats.dropped
      });
    }
    return;
  }

  try {
    voiceCaptureFrameReceiver(frame);
    voiceCaptureFrameStats.delivered += 1;
    voiceCaptureFrameStats.bytes += frame.pcm.length;
    if (shouldLogVoiceFrameProgress()) {
      voiceCaptureFrameStats.lastLogAt = Date.now();
      mainLogger.info('Voice PCM frames delivered to AudioCapture', {
        received: voiceCaptureFrameStats.received,
        delivered: voiceCaptureFrameStats.delivered,
        dropped: voiceCaptureFrameStats.dropped,
        bytes: voiceCaptureFrameStats.bytes,
        lastFrameIndex: frame.frameIndex,
        sampleRate: frame.sampleRate,
        durationMs: frame.durationMs,
        rms: frame.rms
      });
    }
  } catch (error) {
    voiceCaptureFrameStats.dropped += 1;
    mainLogger.warn('Voice PCM frame delivery failed', { error: error.message, frameIndex: frame.frameIndex });
  }
}

function createVoiceCaptureWindow() {
  if (voiceCaptureWindow && !voiceCaptureWindow.isDestroyed()) return voiceCaptureWindow;

  voiceCaptureReady = false;
  voiceCaptureWindow = new BrowserWindow({
    width: 1,
    height: 1,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    focusable: false,
    webPreferences: createSecureWebPreferences(PRELOAD_PATH)
  });

  secureWindow(voiceCaptureWindow, {
    windowType: 'voice-capture',
    expectedFile: VOICE_CAPTURE_FILE,
    createWindow: createVoiceCaptureWindow
  });

  voiceCaptureWindow.webContents.once('did-finish-load', () => {
    voiceCaptureReady = true;
    if (voiceCaptureShouldRun) {
      sendVoiceCaptureCommand('voiceCapture:start', voiceCaptureStartOptions || {
        sampleRate: 16000,
        channels: 1,
        runId: voiceCaptureRunId
      });
    }
  });

  voiceCaptureWindow.on('closed', () => {
    voiceCaptureWindow = null;
    voiceCaptureReady = false;
  });

  voiceCaptureWindow.loadFile(VOICE_CAPTURE_FILE).catch(error => {
    mainLogger.error('Failed to load voice capture renderer', { error: error.message });
  });

  return voiceCaptureWindow;
}

function prewarmVoiceRuntime(reason = 'startup') {
  if (cleanupFinished || cleanupPromise) return false;
  try {
    createVoiceCaptureWindow();
    voiceOverlay?.windowController?.createWindow?.();
    mainLogger.info('Voice runtime prewarmed', { reason, captureReady: voiceCaptureReady });
    return true;
  } catch (error) {
    mainLogger.warn('Voice runtime prewarm failed', { reason, error: error.message });
    return false;
  }
}

function shouldPrewarmVoiceRuntime() {
  return runtimeConfig?.voice?.preloadRuntime === true ||
    process.env.OPENX_PREWARM_VOICE_RUNTIME === '1';
}

function scheduleVoiceRuntimePrewarm(reason = 'startup', delayMs = VOICE_IDLE_RUNTIME_PREWARM_DELAY_MS) {
  if (voiceCaptureWarmupTimer) {
    clearTimeout(voiceCaptureWarmupTimer);
    voiceCaptureWarmupTimer = null;
  }
  if (!shouldPrewarmVoiceRuntime()) {
    mainLogger.info('Voice runtime prewarm skipped until first use', { reason });
    return false;
  }
  const warmupDelayMs = Math.max(0, Number(delayMs) || 0);
  voiceCaptureWarmupTimer = setTimeout(() => {
    voiceCaptureWarmupTimer = null;
    prewarmVoiceRuntime(reason);
  }, warmupDelayMs);
  if (typeof voiceCaptureWarmupTimer.unref === 'function') {
    voiceCaptureWarmupTimer.unref();
  }
  return true;
}

function shouldPrewarmVoiceResources() {
  return runtimeConfig?.voice?.preloadResources === true ||
    runtimeConfig?.voice?.preloadStt === true ||
    process.env.OPENX_PREWARM_VOICE_STT === '1';
}

function scheduleVoiceResourceWarmup(reason = 'post-startup', delayMs = VOICE_IDLE_RESOURCE_WARMUP_DELAY_MS) {
  if (voiceResourceWarmupTimer) {
    clearTimeout(voiceResourceWarmupTimer);
    voiceResourceWarmupTimer = null;
  }
  if (!shouldPrewarmVoiceResources()) {
    mainLogger.info('Voice resource warm-up skipped until first use', { reason });
    return false;
  }
  const warmupDelayMs = Math.max(0, Number(delayMs) || 0);
  voiceResourceWarmupTimer = setTimeout(() => {
    voiceResourceWarmupTimer = null;
    if (!voiceSessionManager || cleanupFinished || cleanupPromise) return;
    try {
      voiceSessionManager.warmUpResources(reason);
    } catch (error) {
      mainLogger.warn('Voice resource warm-up failed', { error: error.message });
    }
  }, warmupDelayMs);
  if (typeof voiceResourceWarmupTimer.unref === 'function') {
    voiceResourceWarmupTimer.unref();
  }
  return true;
}

function buildSettingsSnapshot() {
  return {
    ...settingsService.getSnapshot(),
    securityStatus: initializeSecurityLock().getStatus()
  };
}

const CHAT_HISTORY_LIMIT = 300;
const UI_STATE_SCHEDULE_LIMIT = 80;
const UI_STATE_NOTIFICATION_LIMIT = 30;

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
    .slice(-CHAT_HISTORY_LIMIT);
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
    .slice(-CHAT_HISTORY_LIMIT);
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
      const backup = normalizeChatHistoryEntries(JSON.parse(fs.readFileSync(backupPath, 'utf8')));
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

function clearAssistantChatHistory() {
  writeJsonAtomic(assistantChatHistoryPath(), [], { backup: true, maxBytes: 1024 * 1024 });
  return { success: true, count: 0, entries: [] };
}

function desktopChatConversationsPath() {
  const dataPaths = runtimeConfig?.app?.dataPaths || BASE_CONFIG?.app?.dataPaths || {};
  return dataPaths.chatConversationsPath || path.join(dataPaths.root || BASE_CONFIG.app.dataDir || app.getPath('userData'), 'chat-conversations.json');
}

function desktopChatAccountPath() {
  const dataPaths = runtimeConfig?.app?.dataPaths || BASE_CONFIG?.app?.dataPaths || {};
  return dataPaths.chatAccountPath || path.join(dataPaths.root || BASE_CONFIG.app.dataDir || app.getPath('userData'), 'chat-account.json');
}

function desktopChatDevicePath() {
  const dataPaths = runtimeConfig?.app?.dataPaths || BASE_CONFIG?.app?.dataPaths || {};
  return dataPaths.chatDevicePath || path.join(dataPaths.root || BASE_CONFIG.app.dataDir || app.getPath('userData'), 'chat-device.json');
}

function desktopChatCryptoSecretsPath() {
  const dataPaths = runtimeConfig?.app?.dataPaths || BASE_CONFIG?.app?.dataPaths || {};
  return dataPaths.chatCryptoSecretsPath || path.join(dataPaths.root || BASE_CONFIG.app.dataDir || app.getPath('userData'), 'chat-crypto-secrets.json');
}

function desktopChatMessagesPath() {
  const dataPaths = runtimeConfig?.app?.dataPaths || BASE_CONFIG?.app?.dataPaths || {};
  return dataPaths.chatMessagesPath || path.join(dataPaths.root || BASE_CONFIG.app.dataDir || app.getPath('userData'), 'chat-messages.json');
}

function desktopChatSyncStatePath() {
  const dataPaths = runtimeConfig?.app?.dataPaths || BASE_CONFIG?.app?.dataPaths || {};
  return dataPaths.chatSyncCursorsPath || path.join(dataPaths.root || BASE_CONFIG.app.dataDir || app.getPath('userData'), 'chat-sync-cursors.json');
}

function normalizeDesktopChatApiBaseUrl(value) {
  const fallback = process.env.OPENX_CHAT_API_URL || BASE_CONFIG?.chat?.apiBaseUrl || DEFAULT_CHAT_API_BASE_URL;
  const candidate = String(value || fallback).trim() || DEFAULT_CHAT_API_BASE_URL;
  const parsed = new URL(candidate);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new TypeError('Chat server URL must use http:// or https://.');
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, '');
  parsed.hash = '';
  parsed.search = '';
  return parsed.href.replace(/\/+$/, '');
}

function isLegacyDesktopChatApiBaseUrl(value) {
  try {
    return LEGACY_CHAT_API_BASE_URLS.has(normalizeDesktopChatApiBaseUrl(value).toLowerCase());
  } catch (_) {
    return false;
  }
}

function normalizeDesktopChatRoute(route) {
  const value = String(route || '/').trim();
  return value.startsWith('/') ? value : `/${value}`;
}

function sanitizeDesktopChatRouteForLog(route) {
  return normalizeDesktopChatRoute(route)
    .replace(/acc_[a-f0-9]{64}/gi, '[account-id]')
    .replace(/dev_[a-f0-9]{64}/gi, '[device-id]')
    .replace(/rel_[a-f0-9]{64}/gi, '[relationship-id]')
    .replace(/creq_[a-f0-9]{64}/gi, '[request-id]');
}

function desktopChatTransportErrorCode(error) {
  return String(error?.cause?.code || error?.code || error?.message || 'connection_failed').slice(0, 120);
}

function logDesktopChatLoopbackRetry(route, error, options = {}) {
  if (options.quietOffline) return;
  const now = Date.now();
  if (now - desktopChatLoopbackRetryLogState.lastAt < DESKTOP_CHAT_LOOPBACK_RETRY_LOG_WINDOW_MS) {
    desktopChatLoopbackRetryLogState.suppressed += 1;
    return;
  }

  const suppressedRequests = desktopChatLoopbackRetryLogState.suppressed;
  desktopChatLoopbackRetryLogState.lastAt = now;
  desktopChatLoopbackRetryLogState.suppressed = 0;
  mainLogger.warn('[CHAT] Chat server primary loopback failed; retrying IPv4 loopback', {
    route: sanitizeDesktopChatRouteForLog(route),
    error: desktopChatTransportErrorCode(error),
    suppressedRequests: suppressedRequests || null,
    next: 'retry http://127.0.0.1 before reporting server unreachable'
  });
}

function logDesktopChatOfflineInfo(message, metadata = {}) {
  const now = Date.now();
  if (now - desktopChatOfflineInfoLogState.lastAt < DESKTOP_CHAT_LOOPBACK_RETRY_LOG_WINDOW_MS) {
    desktopChatOfflineInfoLogState.suppressed += 1;
    return;
  }
  const suppressedRequests = desktopChatOfflineInfoLogState.suppressed;
  desktopChatOfflineInfoLogState.lastAt = now;
  desktopChatOfflineInfoLogState.suppressed = 0;
  mainLogger.info(message, {
    ...metadata,
    suppressedRequests: suppressedRequests || null
  });
}

function getDesktopChatRequestUrls(apiBaseUrl, route) {
  const baseUrl = normalizeDesktopChatApiBaseUrl(apiBaseUrl);
  const requestRoute = normalizeDesktopChatRoute(route);
  const urls = [`${baseUrl}${requestRoute}`];
  const parsed = new URL(baseUrl);
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol === 'http:' && (host === 'localhost' || host === '::1' || host === '[::1]')) {
    parsed.hostname = '127.0.0.1';
    const ipv4Url = `${parsed.href.replace(/\/+$/, '')}${requestRoute}`;
    if (!urls.includes(ipv4Url)) urls.push(ipv4Url);
  }
  return urls;
}

function desktopChatWebSocketUrl(apiBaseUrl) {
  const parsed = new URL(normalizeDesktopChatApiBaseUrl(apiBaseUrl));
  parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  parsed.pathname = '/ws';
  parsed.search = '';
  parsed.hash = '';
  return parsed.href;
}

function isDesktopChatTransportError(error) {
  const code = String(error?.code || error?.cause?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();
  return error?.name === 'TypeError'
    || message.includes('fetch failed')
    || ['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH', 'ECONNRESET', 'ETIMEDOUT'].includes(code);
}

function createDesktopChatServerUnavailableError(apiBaseUrl, route, error) {
  const normalizedUrl = (() => {
    try {
      return normalizeDesktopChatApiBaseUrl(apiBaseUrl);
    } catch (_) {
      return DEFAULT_CHAT_API_BASE_URL;
    }
  })();
  const cause = desktopChatTransportErrorCode(error);
  const failure = new Error(`OpenX Chat Server is not reachable at ${normalizedUrl}. Check the deployed server or set OPENX_CHAT_API_URL for a local server such as http://127.0.0.1:8090.`);
  failure.code = 'chat.server_unreachable';
  failure.details = {
    route: sanitizeDesktopChatRouteForLog(route),
    cause
  };
  return failure;
}

function isDesktopChatServerUnavailableError(error) {
  return String(error?.code || '') === 'chat.server_unreachable';
}

function normalizeDesktopChatUsernameInput(value) {
  const rawUsername = normalizeDesktopChatSetupText(value || '', 33);
  const username = rawUsername.startsWith('@') ? rawUsername.slice(1).trim() : rawUsername;
  return /^[A-Za-z0-9._-]{3,32}$/.test(username) ? username : '';
}

function normalizeDesktopChatPasswordInput(value) {
  return typeof value === 'string' && value.length >= 10 && value.length <= 128 ? value : '';
}

function buildDesktopChatRegistrationRequest(username, password) {
  return { username, password };
}

function normalizeDesktopChatSetupText(value, maxLength = 160) {
  return normalizeDesktopChatText(value, maxLength);
}

function redactChatUsername(value) {
  const username = normalizeDesktopChatUsernameInput(value);
  if (!username) return value ? 'Pending username' : '';
  if (username.length <= 2) return `${username.slice(0, 1)}*`;
  return `${username.slice(0, 1)}***${username.slice(-1)}`;
}

function readDesktopChatSafeStorageState() {
  return readJsonFile(desktopChatCryptoSecretsPath(), {
    version: DESKTOP_CHAT_SETUP_VERSION,
    storage: 'electron-safeStorage',
    entries: {}
  }, {
    createIfMissing: true,
    validate: value => isPlainObject(value) && isPlainObject(value.entries || {}),
    maxBytes: 512 * 1024
  });
}

function writeDesktopChatSafeStorageState(state = {}) {
  writeJsonAtomic(desktopChatCryptoSecretsPath(), {
    version: DESKTOP_CHAT_SETUP_VERSION,
    storage: 'electron-safeStorage',
    entries: isPlainObject(state.entries) ? state.entries : {},
    updatedAt: new Date().toISOString()
  }, { maxBytes: 512 * 1024 });
}

function createDesktopChatSafeStorageBackend() {
  return {
    async setSecret(name, value) {
      if (!safeStorage?.isEncryptionAvailable?.()) {
        const error = new Error('Operating-system secure storage is unavailable for OpenX Chat keys.');
        error.code = 'chat.secure_storage_unavailable';
        throw error;
      }
      const key = normalizeDesktopChatSetupText(name, 120);
      if (!key) throw new Error('Secure storage key is required.');
      const state = readDesktopChatSafeStorageState();
      state.entries[key] = {
        storage: 'electron-safeStorage',
        ciphertext: safeStorage.encryptString(JSON.stringify(value)).toString('base64'),
        updatedAt: new Date().toISOString()
      };
      writeDesktopChatSafeStorageState(state);
    },

    async getSecret(name) {
      if (!safeStorage?.isEncryptionAvailable?.()) return null;
      const key = normalizeDesktopChatSetupText(name, 120);
      if (!key) return null;
      const entry = readDesktopChatSafeStorageState().entries?.[key];
      if (!entry?.ciphertext || entry.storage !== 'electron-safeStorage') return null;
      try {
        return JSON.parse(safeStorage.decryptString(Buffer.from(entry.ciphertext, 'base64')));
      } catch (error) {
        mainLogger.warn('[CHAT] Unable to decrypt local chat secret', { key, error: error.message });
        return null;
      }
    },

    async deleteSecret(name) {
      const key = normalizeDesktopChatSetupText(name, 120);
      if (!key) return;
      const state = readDesktopChatSafeStorageState();
      delete state.entries[key];
      writeDesktopChatSafeStorageState(state);
    },

    listKeys() {
      return Object.keys(readDesktopChatSafeStorageState().entries || {});
    }
  };
}

async function getDesktopChatCryptoManager() {
  if (!desktopChatCryptoManager) {
    desktopChatCryptoManager = new CryptoManager({
      config: {
        storagePath: desktopChatCryptoSecretsPath(),
        storageBackend: createDesktopChatSafeStorageBackend()
      },
      logger: {
        info: (message, metadata) => mainLogger.info(`[CHAT] ${message}`, metadata),
        warn: (message, metadata) => mainLogger.warn(`[CHAT] ${message}`, metadata),
        error: (message, metadata) => mainLogger.error(`[CHAT] ${message}`, metadata)
      }
    });
    desktopChatCryptoReady = desktopChatCryptoManager.initialize();
  }
  await desktopChatCryptoReady;
  return desktopChatCryptoManager;
}

function buildDesktopChatPublicKeyPayload(ownerId, keyPair, keyType, metadata = {}) {
  const payload = {
    publicKey: keyPair.publicKey,
    keyVersion: Number(keyPair.keyVersion || 1),
    algorithm: normalizeDesktopChatSetupText(keyPair.algorithm || 'ed25519', 40) || 'ed25519',
    metadata: {
      source: 'openx-desktop-chat',
      generatedAt: normalizeDesktopChatSetupText(keyPair.createdAt || new Date().toISOString(), 80),
      ...metadata
    }
  };
  if (keyType === 'identity') {
    payload.accountId = ownerId;
  } else {
    payload.accountId = metadata.accountId;
    payload.deviceId = ownerId;
  }
  return payload;
}

function isSamePublicKey(left, right) {
  return String(left || '').replace(/\r\n/g, '\n').trim() === String(right || '').replace(/\r\n/g, '\n').trim();
}

async function ensureDesktopChatPublicKeys(accountId, deviceId, apiBaseUrl) {
  if (!isDesktopChatAccountId(accountId) || !isDesktopChatDeviceId(deviceId)) {
    const error = new Error('Chat identity setup needs a verified account and registered device.');
    error.code = 'chat.identity_context_invalid';
    throw error;
  }
  const manager = await getDesktopChatCryptoManager();
  let identityKey = await manager.keyManager.getPrivateKey(`identity:${accountId}`);
  if (!identityKey) {
    identityKey = await manager.identity.generateIdentity(accountId);
  }
  let deviceKey = await manager.keyManager.getPrivateKey(`device:${deviceId}`);
  if (!deviceKey) {
    deviceKey = manager.keyManager.generateDeviceKeyPair();
    await manager.keyManager.storePrivateKey(`device:${deviceId}`, deviceKey);
  }

  let identityPublic = null;
  let devicePublic = null;
  try {
    identityPublic = await desktopChatServerRequest(apiBaseUrl, `/crypto/identity/${encodeURIComponent(accountId)}/public-key`, 'GET');
  } catch (_) {
    identityPublic = null;
  }
  if (!identityPublic?.publicKey || !isSamePublicKey(identityPublic.publicKey, identityKey.publicKey)) {
    identityPublic = await desktopChatServerRequest(
      apiBaseUrl,
      '/crypto/identity/public-key',
      'POST',
      buildDesktopChatPublicKeyPayload(accountId, identityKey, 'identity')
    );
  }

  try {
    devicePublic = await desktopChatServerRequest(apiBaseUrl, `/crypto/device/${encodeURIComponent(deviceId)}/public-key`, 'GET');
  } catch (_) {
    devicePublic = null;
  }
  if (!devicePublic?.publicKey || !isSamePublicKey(devicePublic.publicKey, deviceKey.publicKey)) {
    devicePublic = await desktopChatServerRequest(
      apiBaseUrl,
      '/crypto/device/public-key',
      'POST',
      buildDesktopChatPublicKeyPayload(deviceId, deviceKey, 'device', { accountId })
    );
  }

  return {
    identityReady: true,
    deviceKeyReady: true,
    sessionReady: true,
    storage: 'electron-safeStorage',
    identityFingerprint: normalizeDesktopChatSetupText(identityPublic?.fingerprint || identityKey.fingerprint || '', 120) || null,
    deviceFingerprint: normalizeDesktopChatSetupText(devicePublic?.fingerprint || deviceKey.fingerprint || '', 120) || null,
    identityKeyVersion: Number(identityPublic?.keyVersion || identityKey.keyVersion || 1),
    deviceKeyVersion: Number(devicePublic?.keyVersion || deviceKey.keyVersion || 1),
    updatedAt: new Date().toISOString()
  };
}

function readDesktopChatSetupState() {
  const fallback = {
    version: DESKTOP_CHAT_SETUP_VERSION,
    apiBaseUrl: normalizeDesktopChatApiBaseUrl(),
    registered: false,
    account: null,
    device: null,
    crypto: null,
    username: null,
    pinEnabled: false,
    lastServerConnectedAt: null,
    updatedAt: null
  };
  const state = readJsonFile(desktopChatAccountPath(), fallback, {
    createIfMissing: true,
    validate: value => isPlainObject(value),
    maxBytes: 128 * 1024
  });
  return normalizeDesktopChatSetupState({ ...fallback, ...state });
}

function writeDesktopChatSetupState(state = {}) {
  const normalized = normalizeDesktopChatSetupState(state);
  writeJsonAtomic(desktopChatAccountPath(), normalized, { maxBytes: 128 * 1024 });
  return normalized;
}

function normalizeDesktopChatDeviceState(value = {}) {
  const state = isPlainObject(value) ? value : {};
  const clientDeviceKey = /^[a-f0-9]{48}$/i.test(String(state.clientDeviceKey || ''))
    ? String(state.clientDeviceKey).toLowerCase()
    : crypto.randomBytes(24).toString('hex');
  return {
    version: DESKTOP_CHAT_SETUP_VERSION,
    clientDeviceKey,
    accountId: normalizeDesktopChatSetupText(state.accountId || '', 100) || null,
    apiBaseUrl: normalizeDesktopChatSetupText(state.apiBaseUrl || '', 240) || null,
    device: isPlainObject(state.device) ? state.device : null,
    approval: isPlainObject(state.approval) ? state.approval : null,
    updatedAt: normalizeDesktopChatSetupText(state.updatedAt || new Date().toISOString(), 80)
  };
}

function readDesktopChatDeviceState() {
  const state = readJsonFile(desktopChatDevicePath(), {}, {
    createIfMissing: false,
    validate: value => isPlainObject(value),
    maxBytes: 128 * 1024
  });
  return normalizeDesktopChatDeviceState(state);
}

function writeDesktopChatDeviceState(state = {}) {
  const normalized = normalizeDesktopChatDeviceState({
    ...state,
    updatedAt: new Date().toISOString()
  });
  writeJsonAtomic(desktopChatDevicePath(), normalized, { maxBytes: 128 * 1024 });
  return normalized;
}

function readDesktopChatSyncState() {
  const fallback = { version: 1, cursors: {} };
  const state = readJsonFile(desktopChatSyncStatePath(), fallback, {
    createIfMissing: true,
    validate: value => isPlainObject(value),
    maxBytes: 128 * 1024
  });
  return {
    version: 1,
    cursors: isPlainObject(state.cursors) ? state.cursors : {}
  };
}

function writeDesktopChatSyncState(state = {}) {
  const normalized = {
    version: 1,
    cursors: isPlainObject(state.cursors) ? state.cursors : {}
  };
  writeJsonAtomic(desktopChatSyncStatePath(), normalized, { maxBytes: 128 * 1024 });
  return normalized;
}

function getDesktopChatSyncCursor(deviceId) {
  const state = readDesktopChatSyncState();
  const cursor = isPlainObject(state.cursors?.[deviceId]) ? state.cursors[deviceId] : {};
  const lastAck = Number(cursor.lastAck || 0);
  return {
    lastAck: Number.isFinite(lastAck) && lastAck > 0 ? Math.floor(lastAck) : 0,
    updatedAt: normalizeDesktopChatSetupText(cursor.updatedAt || '', 80) || null
  };
}

function writeDesktopChatSyncCursor(deviceId, lastAck) {
  if (!isDesktopChatDeviceId(deviceId)) return getDesktopChatSyncCursor(deviceId);
  const state = readDesktopChatSyncState();
  state.cursors[deviceId] = {
    lastAck: Math.max(0, Math.floor(Number(lastAck) || 0)),
    updatedAt: new Date().toISOString()
  };
  writeDesktopChatSyncState(state);
  return state.cursors[deviceId];
}

function normalizeDesktopChatSetupState(state = {}) {
  let apiBaseUrl = DEFAULT_CHAT_API_BASE_URL;
  try {
    apiBaseUrl = normalizeDesktopChatApiBaseUrl(state.apiBaseUrl);
  } catch (_) {
    apiBaseUrl = normalizeDesktopChatApiBaseUrl();
  }
  if (
    Number(state.version || 0) < DESKTOP_CHAT_SETUP_VERSION
    && !state.registered
    && isLegacyDesktopChatApiBaseUrl(apiBaseUrl)
    && !process.env.OPENX_CHAT_API_URL
  ) {
    apiBaseUrl = normalizeDesktopChatApiBaseUrl();
  }
  const account = isPlainObject(state.account) ? state.account : null;
  const device = isPlainObject(state.device) ? state.device : null;
  const accountId = normalizeDesktopChatSetupText(account?.accountId || state.accountId || '', 100) || null;
  const username = normalizeDesktopChatUsernameInput(account?.username || state.username || '');
  return {
    version: DESKTOP_CHAT_SETUP_VERSION,
    apiBaseUrl,
    registered: Boolean(state.registered && accountId),
    account: accountId ? {
      accountId,
      accountStatus: normalizeDesktopChatSetupText(account?.accountStatus || state.accountStatus || 'Active', 40) || 'Active',
      securityState: normalizeDesktopChatSetupText(account?.securityState || state.securityState || 'Verified', 40) || 'Verified',
      verificationState: normalizeDesktopChatSetupText(account?.verificationState || state.verificationState || 'Verified', 40) || 'Verified',
      username,
      registrationDate: normalizeDesktopChatSetupText(account?.registrationDate || state.registrationDate || '', 80) || null,
      lastUpdated: normalizeDesktopChatSetupText(account?.lastUpdated || state.lastUpdated || '', 80) || null
    } : null,
    device: device?.deviceId ? {
      deviceId: normalizeDesktopChatSetupText(device.deviceId, 100),
      deviceName: normalizeDesktopChatSetupText(device.deviceName || os.hostname(), 80) || os.hostname(),
      platform: normalizeDesktopChatSetupText(device.platform || '', 40) || null,
      deviceType: normalizeDesktopChatSetupText(device.deviceType || '', 40) || null,
      deviceStatus: normalizeDesktopChatSetupText(device.deviceStatus || '', 40) || null,
      approvalStatus: normalizeDesktopChatSetupText(device.approvalStatus || '', 40) || null,
      publicIdentity: normalizeDesktopChatSetupText(device.publicIdentity || '', 160) || null
    } : null,
    crypto: normalizeDesktopChatCryptoState(state.crypto),
    username: username || null,
    pinEnabled: state.pinEnabled === true,
    lastServerConnectedAt: normalizeDesktopChatSetupText(state.lastServerConnectedAt || '', 80) || null,
    updatedAt: normalizeDesktopChatSetupText(state.updatedAt || new Date().toISOString(), 80)
  };
}

function serializeDesktopChatSetupState(state = {}) {
  const normalized = normalizeDesktopChatSetupState(state);
  const runtime = deriveDesktopChatRuntime(normalized);
  const cryptoState = normalizeDesktopChatCryptoState(normalized.crypto);
  return {
    success: true,
    registered: normalized.registered,
    pending: false,
    chatReady: runtime.chatReady,
    runtimeState: runtime.runtimeState,
    blockingReason: runtime.blockingReason,
    deviceApproved: runtime.deviceApproved,
    deviceApprovalRequired: runtime.blockingReason === 'device_approval_required',
    identityReady: runtime.identityReady,
    sessionReady: runtime.sessionReady,
    setupStatus: runtime.chatReady
      ? 'chat-ready'
      : (normalized.registered ? 'registered' : 'not-registered'),
    setupMode: null,
    apiBaseUrl: normalized.apiBaseUrl,
    username: normalized.username || normalized.account?.username || null,
    accountId: normalized.account?.accountId || null,
    account: normalized.account,
    device: normalized.device,
    crypto: {
      identityReady: cryptoState.identityReady,
      deviceKeyReady: cryptoState.deviceKeyReady,
      sessionReady: cryptoState.sessionReady,
      storage: cryptoState.storage,
      identityFingerprint: cryptoState.identityFingerprint,
      deviceFingerprint: cryptoState.deviceFingerprint,
      identityKeyVersion: cryptoState.identityKeyVersion,
      deviceKeyVersion: cryptoState.deviceKeyVersion,
      errorCode: cryptoState.errorCode,
      errorMessage: cryptoState.errorMessage,
      updatedAt: cryptoState.updatedAt
    },
    pinEnabled: normalized.pinEnabled,
    lastServerConnectedAt: normalized.lastServerConnectedAt,
    updatedAt: normalized.updatedAt
  };
}

async function desktopChatServerRequest(apiBaseUrl, route, method = 'GET', body = null, options = {}) {
  if (typeof fetch !== 'function') throw new Error('Chat server connection is not available in this runtime.');
  const requestUrls = getDesktopChatRequestUrls(apiBaseUrl, route);
  let lastTransportError = null;
  for (let index = 0; index < requestUrls.length; index += 1) {
    const requestUrl = requestUrls[index];
    const controller = new AbortController();
    const timeoutMs = Math.max(1000, Number(options.timeoutMs || DESKTOP_CHAT_REQUEST_TIMEOUT_MS));
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(requestUrl, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
      const text = await response.text();
      const json = text ? JSON.parse(text) : {};
      if (!response.ok || json.ok === false) {
        const message = json.error?.message || json.errors?.[0]?.message || `Chat server returned ${response.status}.`;
        const error = new Error(message);
        error.statusCode = response.status;
        error.code = json.error?.code || json.errors?.[0]?.code || 'chat.request_failed';
        error.details = json.error?.details || json.errors?.[0]?.details || null;
        throw error;
      }
      return json.data || json || {};
    } catch (error) {
      if (error.name === 'AbortError') {
        const timeout = new Error('Chat server did not respond in time.');
        timeout.code = 'chat.request_timeout';
        throw timeout;
      }
      if (isDesktopChatTransportError(error)) {
        lastTransportError = error;
        if (index < requestUrls.length - 1) {
          logDesktopChatLoopbackRetry(route, error, options);
          continue;
        }
        throw createDesktopChatServerUnavailableError(apiBaseUrl, route, error);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw createDesktopChatServerUnavailableError(apiBaseUrl, route, lastTransportError);
}

function isDesktopChatAccountId(value) {
  return /^acc_[a-f0-9]{64}$/i.test(String(value || '').trim());
}

function isDesktopChatDeviceId(value) {
  return /^dev_[a-f0-9]{64}$/i.test(String(value || '').trim());
}

function isDesktopChatRelationshipId(value) {
  return /^rel_[a-f0-9]{64}$/i.test(String(value || '').trim());
}

function isDesktopChatRequestId(value) {
  return /^creq_[a-f0-9]{64}$/i.test(String(value || '').trim());
}

function buildDesktopChatLocalRelationshipId(seed) {
  return `rel_${crypto.createHash('sha256').update(`openx-chat-peer:${String(seed || '')}`).digest('hex')}`;
}

function decodeDesktopChatBase64Url(value, maxBytes = 4096) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > maxBytes * 2) return '';
  try {
    return Buffer.from(raw, 'base64url').toString('utf8');
  } catch (_) {
    return '';
  }
}

function decodeDesktopChatBase64UrlBuffer(value, maxBytes = 64 * 1024) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > maxBytes * 2) return null;
  try {
    const decoded = Buffer.from(raw, 'base64url');
    return decoded.length <= maxBytes ? decoded : null;
  } catch (_) {
    return null;
  }
}

function parseDesktopChatTransportPacket(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const decoded = raw.startsWith('{') ? raw : decodeDesktopChatBase64Url(raw, 16 * 1024);
  if (!decoded) return null;
  try {
    const packet = JSON.parse(decoded);
    return isPlainObject(packet) ? packet : null;
  } catch (_) {
    return null;
  }
}

function normalizeDesktopChatAccountForKey(value) {
  const normalized = normalizeDesktopChatSetupText(value || '', 100).toLowerCase();
  return isDesktopChatAccountId(normalized) ? normalized : '';
}

function collectDesktopChatRelationshipAccountIds(context = {}) {
  const envelope = isPlainObject(context.envelope) ? context.envelope : {};
  const metadata = isPlainObject(context.metadata)
    ? context.metadata
    : (isPlainObject(envelope.metadata) ? envelope.metadata : {});
  const conversationMetadata = isPlainObject(context.conversation?.metadata)
    ? context.conversation.metadata
    : {};
  const candidates = [
    context.senderAccountId,
    context.recipientAccountId,
    envelope.senderAccountId,
    envelope.recipientAccountId,
    metadata.senderAccountId,
    metadata.recipientAccountId
  ].map(normalizeDesktopChatAccountForKey).filter(Boolean);
  const unique = [...new Set(candidates)];

  if (unique.length < 2) {
    [
      context.localAccountId,
      conversationMetadata.senderAccountId,
      conversationMetadata.recipientAccountId,
      conversationMetadata.peerAccountId
    ].map(normalizeDesktopChatAccountForKey)
      .filter(Boolean)
      .forEach(accountId => {
        if (!unique.includes(accountId)) unique.push(accountId);
      });
  }

  return unique.slice(0, 2).sort();
}

function buildDesktopChatRelationshipSessionKey(context = {}) {
  const envelope = isPlainObject(context.envelope) ? context.envelope : {};
  const metadata = isPlainObject(context.metadata)
    ? context.metadata
    : (isPlainObject(envelope.metadata) ? envelope.metadata : {});
  const relationshipId = normalizeDesktopChatSetupText(
    context.relationshipId || envelope.relationshipId || metadata.relationshipId || '',
    100
  ).toLowerCase();
  const accountIds = collectDesktopChatRelationshipAccountIds({ ...context, envelope, metadata });
  if (!isDesktopChatRelationshipId(relationshipId) || accountIds.length < 2) return null;
  return crypto
    .createHash('sha256')
    .update(`OpenXChat:relationship-session:v1:${relationshipId}:${accountIds.join(':')}`, 'utf8')
    .digest();
}

function buildDesktopChatMessageAad(messageId, relationshipId, version = '1') {
  const safeMessageId = normalizeDesktopChatSetupText(messageId || '', 100).toLowerCase();
  const safeRelationshipId = normalizeDesktopChatSetupText(relationshipId || '', 100).toLowerCase();
  if (!/^msg_[a-f0-9]{64}$/i.test(safeMessageId) || !isDesktopChatRelationshipId(safeRelationshipId)) return '';
  return `OpenXChat:v${version || '1'}:message:${safeMessageId}:${safeRelationshipId}`;
}

function decryptDesktopChatTransportPacket(envelope = {}, context = {}) {
  const packet = parseDesktopChatTransportPacket(envelope.ciphertext);
  if (!packet || packet.keyScope === 'local-device-preview') return '';
  const algorithm = normalizeDesktopChatSetupText(packet.algorithm || packet.alg || '', 40);
  if (algorithm !== 'AES-GCM' && algorithm !== 'AES-256-GCM') return '';

  const metadata = isPlainObject(envelope.metadata) ? envelope.metadata : {};
  const relationshipId = normalizeDesktopChatSetupText(
    context.relationshipId || envelope.relationshipId || metadata.relationshipId || '',
    100
  ).toLowerCase();
  const messageId = normalizeDesktopChatSetupText(envelope.messageId || metadata.messageId || '', 100).toLowerCase();
  const key = buildDesktopChatRelationshipSessionKey({
    ...context,
    envelope,
    metadata,
    relationshipId
  });
  const aadText = packet.aad
    ? decodeDesktopChatBase64Url(packet.aad, 2048)
    : buildDesktopChatMessageAad(messageId, relationshipId, envelope.protocolVersion || metadata.messageVersion || '1');
  const expectedAad = buildDesktopChatMessageAad(messageId, relationshipId, envelope.protocolVersion || metadata.messageVersion || '1');
  if (!key || !aadText || aadText !== expectedAad) return '';

  const iv = decodeDesktopChatBase64UrlBuffer(packet.iv, 32);
  const tag = decodeDesktopChatBase64UrlBuffer(packet.tag, 32);
  const ciphertext = decodeDesktopChatBase64UrlBuffer(packet.ciphertext, 16 * 1024);
  if (!iv || !tag || !ciphertext || iv.length !== 12 || tag.length !== 16) return '';

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(Buffer.from(aadText, 'utf8'));
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    return normalizeDesktopChatText(plaintext, 1200);
  } catch (_) {
    return '';
  }
}

function decodeDesktopChatIncomingPreview(envelope = {}, context = {}) {
  const plaintext = decryptDesktopChatTransportPacket(envelope, context);
  if (plaintext) return plaintext;

  const metadata = isPlainObject(envelope.metadata) ? envelope.metadata : {};
  const directPreview = normalizeDesktopChatText(
    metadata.notificationPreview || metadata.messagePreview || metadata.preview || metadata.bodyPreview || '',
    DESKTOP_CHAT_NOTIFICATION_PREVIEW_MAX
  );
  if (directPreview) return directPreview;

  const packet = parseDesktopChatTransportPacket(envelope.ciphertext);
  if (!packet) return '';
  if (packet.notificationPreview) {
    const decoded = normalizeDesktopChatText(
      decodeDesktopChatBase64Url(packet.notificationPreview, DESKTOP_CHAT_NOTIFICATION_PREVIEW_MAX * 4),
      DESKTOP_CHAT_NOTIFICATION_PREVIEW_MAX
    );
    if (decoded) return decoded;
  }
  return normalizeDesktopChatText(packet.preview || packet.messagePreview || packet.text || '', DESKTOP_CHAT_NOTIFICATION_PREVIEW_MAX);
}

async function decodeDesktopChatIncomingMessageText(envelope = {}, context = {}) {
  const registered = context.registered || getRegisteredDesktopChatContext({ requireReady: false });
  try {
    const messageManager = await getDesktopChatMessageManager(registered.apiBaseUrl);
    const received = await messageManager.receiveEnvelope({
      envelope,
      relationshipId: context.relationshipId,
      senderAccountId: context.senderAccountId,
      recipientAccountId: context.recipientAccountId,
      localAccountId: context.localAccountId,
      conversation: context.conversation
    });
    return normalizeDesktopChatText(received?.plaintext || '', 1200);
  } catch (error) {
    mainLogger.debug?.('[CHAT] Shared chat envelope decode fell back to legacy preview decoder', {
      code: error.code || 'chat.decode_failed',
      messageId: normalizeDesktopChatSetupText(envelope.messageId || envelope.metadata?.messageId || '', 100)
    });
    return decodeDesktopChatIncomingPreview(envelope, context);
  }
}

function normalizeDesktopChatCryptoState(value = {}) {
  const source = isPlainObject(value) ? value : {};
  const identityKeyVersion = Number(source.identityKeyVersion);
  const deviceKeyVersion = Number(source.deviceKeyVersion);
  return {
    identityReady: source.identityReady === true,
    deviceKeyReady: source.deviceKeyReady === true,
    sessionReady: source.sessionReady === true,
    storage: normalizeDesktopChatSetupText(source.storage || '', 60) || null,
    identityFingerprint: normalizeDesktopChatSetupText(source.identityFingerprint || '', 120) || null,
    deviceFingerprint: normalizeDesktopChatSetupText(source.deviceFingerprint || '', 120) || null,
    identityKeyVersion: Number.isInteger(identityKeyVersion) && identityKeyVersion > 0 ? identityKeyVersion : null,
    deviceKeyVersion: Number.isInteger(deviceKeyVersion) && deviceKeyVersion > 0 ? deviceKeyVersion : null,
    errorCode: normalizeDesktopChatSetupText(source.errorCode || '', 80) || null,
    errorMessage: normalizeDesktopChatSetupText(source.errorMessage || '', 220) || null,
    updatedAt: normalizeDesktopChatSetupText(source.updatedAt || '', 80) || null
  };
}

function isDesktopChatDeviceApproved(device = {}) {
  return ChatRuntimeStateMachine.isDeviceApproved(device || {});
}

function deriveDesktopChatRuntime(state = {}) {
  const normalized = normalizeDesktopChatSetupState(state);
  const cryptoState = normalizeDesktopChatCryptoState(normalized.crypto);
  return ChatRuntimeStateMachine.derive({
    apiBaseUrl: normalized.apiBaseUrl,
    serverConnected: Boolean(normalized.apiBaseUrl),
    accountVerified: normalized.registered && isDesktopChatAccountId(normalized.account?.accountId),
    deviceRegistered: isDesktopChatDeviceId(normalized.device?.deviceId),
    device: normalized.device,
    identityReady: cryptoState.identityReady && cryptoState.deviceKeyReady,
    sessionReady: cryptoState.sessionReady
  });
}

async function refreshDesktopChatRegisteredDeviceState(state = {}, options = {}) {
  const normalized = normalizeDesktopChatSetupState(state);
  if (!isDesktopChatDeviceId(normalized.device?.deviceId)) return normalized;
  try {
    const refreshed = await desktopChatServerRequest(
      normalized.apiBaseUrl,
      `/device/status/${encodeURIComponent(normalized.device.deviceId)}`,
      'GET',
      null,
      { quietOffline: options.quietOffline === true }
    );
    const updatedDevice = {
      ...normalized.device,
      ...refreshed
    };
    const deviceState = readDesktopChatDeviceState();
    if (deviceState.device?.deviceId === updatedDevice.deviceId) {
      writeDesktopChatDeviceState({
        ...deviceState,
        accountId: normalized.account?.accountId || deviceState.accountId,
        apiBaseUrl: normalized.apiBaseUrl,
        device: {
          ...deviceState.device,
          ...updatedDevice
        }
      });
    }
    return writeDesktopChatSetupState({
      ...normalized,
      device: updatedDevice,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    if (options.quietOffline && isDesktopChatServerUnavailableError(error)) {
      logDesktopChatOfflineInfo('[CHAT] Chat Server is offline; device status refresh skipped', {
        server: normalized.apiBaseUrl,
        next: 'start OpenX_Chat_Server when you want to use real-user chat'
      });
      return normalized;
    }
    mainLogger.warn('[CHAT] Unable to refresh desktop chat device status', { error: error.message });
    return normalized;
  }
}

async function reconcileDesktopChatSetupState(options = {}) {
  let state = await refreshDesktopChatRegisteredDeviceState(readDesktopChatSetupState(), options);
  const accountId = normalizeDesktopChatSetupText(state.account?.accountId || '', 100).toLowerCase();
  const deviceId = normalizeDesktopChatSetupText(state.device?.deviceId || '', 100).toLowerCase();
  if (state.registered && isDesktopChatAccountId(accountId) && isDesktopChatDeviceId(deviceId) && isDesktopChatDeviceApproved(state.device)) {
    try {
      const cryptoState = await ensureDesktopChatPublicKeys(accountId, deviceId, state.apiBaseUrl);
      state = writeDesktopChatSetupState({
        ...state,
        crypto: cryptoState,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      if (options.quietOffline && isDesktopChatServerUnavailableError(error)) {
        logDesktopChatOfflineInfo('[CHAT] Chat Server is offline; identity key publish skipped until reconnect', {
          server: state.apiBaseUrl,
          next: 'identity keys remain local and will publish when the server is reachable'
        });
        return state;
      }
      mainLogger.warn('[CHAT] Desktop chat identity setup is not ready', { code: error.code, error: error.message });
      state = writeDesktopChatSetupState({
        ...state,
        crypto: {
          ...normalizeDesktopChatCryptoState(state.crypto),
          identityReady: false,
          deviceKeyReady: false,
          sessionReady: false,
          errorCode: normalizeDesktopChatSetupText(error.code || 'chat.identity_not_ready', 80),
          errorMessage: normalizeDesktopChatSetupText(error.message || 'Chat identity setup is not ready.', 220),
          updatedAt: new Date().toISOString()
        },
        updatedAt: new Date().toISOString()
      });
    }
  }
  return state;
}

function getRegisteredDesktopChatContext(options = {}) {
  const state = readDesktopChatSetupState();
  const accountId = normalizeDesktopChatSetupText(state.account?.accountId || '', 100).toLowerCase();
  const deviceId = normalizeDesktopChatSetupText(state.device?.deviceId || '', 100).toLowerCase();
  if (!state.registered || !isDesktopChatAccountId(accountId) || !isDesktopChatDeviceId(deviceId)) {
    const error = new Error('Register this desktop in Chat settings before adding or messaging real OpenX users.');
    error.code = 'chat.registration_required';
    throw error;
  }
  const runtime = deriveDesktopChatRuntime(state);
  if (options.requireReady !== false && !runtime.chatReady) {
    const error = new Error(runtime.blockingReason === 'device_approval_required'
      ? 'Approve this desktop from an already trusted OpenX Chat device before messaging.'
      : 'Finish Chat settings setup before adding or messaging real OpenX users.');
    error.code = runtime.blockingReason || 'chat.not_ready';
    error.runtimeState = runtime.runtimeState;
    throw error;
  }
  return {
    state,
    runtime,
    apiBaseUrl: normalizeDesktopChatApiBaseUrl(state.apiBaseUrl),
    accountId,
    device: state.device
  };
}

function getDesktopChatOtherAccountId(relationship = {}, accountId = '') {
  const owner = String(accountId || '').trim().toLowerCase();
  const accountA = String(relationship.accountA || '').trim().toLowerCase();
  const accountB = String(relationship.accountB || '').trim().toLowerCase();
  if (accountA === owner) return accountB;
  if (accountB === owner) return accountA;
  return '';
}

function normalizeDesktopChatRequestRecord(request = {}, accountId = '') {
  const requestId = normalizeDesktopChatSetupText(request.requestId || '', 100).toLowerCase();
  if (!isDesktopChatRequestId(requestId)) return null;
  const owner = String(accountId || '').trim().toLowerCase();
  const senderAccountId = normalizeDesktopChatSetupText(request.senderAccountId || '', 100).toLowerCase();
  const recipientAccountId = normalizeDesktopChatSetupText(request.recipientAccountId || '', 100).toLowerCase();
  const incoming = recipientAccountId === owner;
  const metadata = isPlainObject(request.metadata) ? request.metadata : {};
  const peerAccountId = incoming ? senderAccountId : recipientAccountId;
  const fallbackTitle = peerAccountId ? `${peerAccountId.slice(0, 10)}...${peerAccountId.slice(-4)}` : 'OpenX user';
  return {
    requestId,
    direction: incoming ? 'incoming' : 'outgoing',
    status: normalizeDesktopChatSetupText(request.status || 'Pending', 40) || 'Pending',
    trustState: normalizeDesktopChatSetupText(request.trustState || '', 40) || null,
    senderAccountId,
    recipientAccountId,
    peerAccountId,
    title: normalizeDesktopChatSetupText(metadata.peerName || metadata.senderName || metadata.displayName || fallbackTitle, 80) || fallbackTitle,
    peerHandle: normalizeDesktopChatSetupText(metadata.peerHandle || metadata.emailDisplay || peerAccountId, 120) || peerAccountId,
    messagePreview: normalizeDesktopChatSetupText(request.messagePreview || '', 160) || null,
    createdAt: normalizeDesktopChatSetupText(request.createdAt || '', 80) || null,
    updatedAt: normalizeDesktopChatSetupText(request.updatedAt || '', 80) || null,
    expiresAt: normalizeDesktopChatSetupText(request.expiresAt || '', 80) || null
  };
}

function normalizeDesktopChatRelationshipRecord(relationship = {}, accountId = '') {
  const relationshipId = normalizeDesktopChatSetupText(relationship.relationshipId || '', 100).toLowerCase();
  if (!isDesktopChatRelationshipId(relationshipId)) return null;
  const peerAccountId = getDesktopChatOtherAccountId(relationship, accountId);
  if (!isDesktopChatAccountId(peerAccountId)) return null;
  return {
    relationshipId,
    peerAccountId,
    accountA: normalizeDesktopChatSetupText(relationship.accountA || '', 100).toLowerCase(),
    accountB: normalizeDesktopChatSetupText(relationship.accountB || '', 100).toLowerCase(),
    status: normalizeDesktopChatSetupText(relationship.status || 'Trusted', 40) || 'Trusted',
    sourceRequestId: normalizeDesktopChatSetupText(relationship.sourceRequestId || '', 100).toLowerCase() || null,
    createdAt: normalizeDesktopChatSetupText(relationship.createdAt || '', 80) || null,
    updatedAt: normalizeDesktopChatSetupText(relationship.updatedAt || '', 80) || null
  };
}

async function findDesktopChatConversationByMetadata(manager, predicate) {
  const conversations = await manager.storage.listConversations();
  return conversations.find(conversation => !conversation.deleted && predicate(conversation.metadata || {}, conversation)) || null;
}

async function updateDesktopChatConversationRelationship(manager, conversation, relationshipId, metadata = {}) {
  const updated = {
    ...conversation,
    relationshipId,
    metadata: {
      ...(conversation.metadata || {}),
      ...metadata
    },
    deleted: false,
    hidden: false,
    updatedAt: new Date().toISOString()
  };
  await manager.storage.upsertConversation(updated);
  await manager.indexManager.indexConversation(updated);
  await manager.storage.audit({ event: 'ServerRelationshipLinked', conversationId: updated.conversationId, relationshipId });
  return updated;
}

async function ensureDesktopChatTrustedConversation(manager, relationship, accountId, metadata = {}) {
  const normalized = normalizeDesktopChatRelationshipRecord(relationship, accountId);
  if (!normalized) throw new Error('Chat server returned an invalid trusted relationship.');
  const title = normalizeDesktopChatText(metadata.title || metadata.peerName || metadata.name || 'OpenX user', 80) || 'OpenX user';
  const peerHandle = normalizeDesktopChatText(metadata.peerHandle || normalized.peerAccountId, 120) || normalized.peerAccountId;
  const patch = {
    title,
    name: title,
    status: 'Trusted',
    peerHandle,
    peerType: metadata.peerType || 'account',
    serverStatus: 'trusted',
    senderAccountId: accountId,
    recipientAccountId: normalized.peerAccountId,
    peerAccountId: normalized.peerAccountId,
    sourceRequestId: normalized.sourceRequestId || metadata.contactRequestId || '',
    contactRequestId: metadata.contactRequestId || normalized.sourceRequestId || '',
    addedFrom: metadata.addedFrom || 'desktop-chat-server'
  };
  const existing = await manager.storage.getConversationByRelationship(normalized.relationshipId);
  if (existing) return manager.updateConversationMetadata(existing.conversationId, patch);
  const pending = patch.contactRequestId
    ? await findDesktopChatConversationByMetadata(manager, item => item.contactRequestId === patch.contactRequestId)
    : null;
  const pendingByPeer = pending || await findDesktopChatConversationByMetadata(manager, item => {
    const itemStatus = normalizeDesktopChatSetupText(item.serverStatus || '', 40);
    if (itemStatus !== 'request-pending') return false;
    const itemRecipient = normalizeDesktopChatSetupText(item.recipientAccountId || item.peerAccountId || '', 100).toLowerCase();
    const itemHandle = normalizeDesktopChatUsernameInput(item.peerHandle || item.username || '');
    const patchHandle = normalizeDesktopChatUsernameInput(patch.peerHandle || '');
    if (isDesktopChatAccountId(itemRecipient) && itemRecipient === normalized.peerAccountId) return true;
    return Boolean(itemHandle && patchHandle && itemHandle === patchHandle);
  });
  if (pendingByPeer) return updateDesktopChatConversationRelationship(manager, pendingByPeer, normalized.relationshipId, patch);
  return manager.createConversation({
    relationshipId: normalized.relationshipId,
    metadata: patch
  });
}

function buildDesktopChatDevicePayload(accountId, clientDeviceKey) {
  const platform = process.platform === 'win32'
    ? 'windows'
    : (process.platform === 'darwin' ? 'macos' : (process.platform === 'linux' ? 'linux' : 'desktop'));
  return {
    accountId,
    deviceName: `${os.hostname() || 'OpenX'} Desktop`,
    platform,
    platformVersion: os.release(),
    applicationVersion: BASE_CONFIG?.app?.version || '0.1.0',
    operatingSystem: `${os.type()} ${os.release()}`,
    deviceType: 'Desktop',
    capabilities: ['persistentConnection', 'largeStorage', 'backgroundProcessing'],
    metadata: {
      source: 'openx-desktop-chat',
      runtime: 'electron'
    },
    clientDeviceKey
  };
}

async function ensureDesktopChatDevice(accountId, apiBaseUrl) {
  const deviceState = readDesktopChatDeviceState();
  const existing = deviceState.device;
  if (
    existing?.deviceId &&
    deviceState.accountId === accountId &&
    normalizeDesktopChatApiBaseUrl(deviceState.apiBaseUrl) === normalizeDesktopChatApiBaseUrl(apiBaseUrl)
  ) {
    return existing;
  }

  const data = await desktopChatServerRequest(
    apiBaseUrl,
    '/device/register',
    'POST',
    buildDesktopChatDevicePayload(accountId, deviceState.clientDeviceKey)
  );
  const registeredDevice = data.device || null;
  writeDesktopChatDeviceState({
    ...deviceState,
    accountId,
    apiBaseUrl,
    device: registeredDevice,
    approval: data.approval || null
  });
  return registeredDevice;
}

async function getDesktopChatRegistrationStatus() {
  const state = await reconcileDesktopChatSetupState({ quietOffline: true });
  const serialized = serializeDesktopChatSetupState(state);
  if (serialized.chatReady) {
    startDesktopChatReceiveRuntime({
      state,
      reason: 'registration-status',
      quietOffline: true,
      notify: true
    }).catch(error => {
      if (!isDesktopChatServerUnavailableError(error)) {
        mainLogger.warn('[CHAT] Chat receive startup from registration status failed', {
          code: error.code || 'chat.receive_start_failed',
          error: error.message
        });
      }
    });
  }
  return serialized;
}

function desktopChatRegistrationFailure(error, state = null) {
  const code = normalizeDesktopChatSetupText(error?.code || 'chat.registration_failed', 80);
  const message = normalizeDesktopChatSetupText(error?.message || 'Chat registration failed.', 220);
  return {
    success: false,
    registered: Boolean(state?.registered),
    pending: false,
    error: {
      code,
      message
    },
    state: state ? serializeDesktopChatSetupState(state) : null
  };
}

function desktopChatReadyMessage(runtime = {}) {
  return runtime.chatReady
    ? 'OpenX Chat account and desktop device are ready.'
    : 'This desktop is registered, but it needs approval from an already trusted OpenX Chat device before messaging.';
}

async function completeDesktopChatRegistrationWithAccount(input = {}) {
  const account = isPlainObject(input.account) ? input.account : {};
  const apiBaseUrl = normalizeDesktopChatApiBaseUrl(input.apiBaseUrl);
  const username = normalizeDesktopChatUsernameInput(input.username || account.username || '');
  const previousState = input.previousState || readDesktopChatSetupState();
  const accountId = normalizeDesktopChatSetupText(account.accountId, 100);
  if (!/^acc_[a-f0-9]{64}$/i.test(accountId)) throw new Error('Chat server returned an invalid account id.');
  const device = await ensureDesktopChatDevice(accountId, apiBaseUrl);
  let pinEnabled = previousState.pinEnabled === true;
  const pin = normalizeDesktopChatSetupText(input.pin || '', 24);
  if (pin) {
    await desktopChatServerRequest(apiBaseUrl, '/security/pin/create', 'POST', {
      accountId,
      deviceId: device?.deviceId || null,
      pin
    });
    pinEnabled = true;
  }
  let cryptoState = normalizeDesktopChatCryptoState();
  if (isDesktopChatDeviceApproved(device)) {
    try {
      cryptoState = await ensureDesktopChatPublicKeys(accountId, device.deviceId, apiBaseUrl);
    } catch (error) {
      mainLogger.warn('[CHAT] Desktop chat key registration failed after account verification', { code: error.code, error: error.message });
      cryptoState = {
        identityReady: false,
        deviceKeyReady: false,
        sessionReady: false,
        errorCode: normalizeDesktopChatSetupText(error.code || 'chat.identity_not_ready', 80),
        errorMessage: normalizeDesktopChatSetupText(error.message || 'Chat identity setup is not ready.', 220),
        updatedAt: new Date().toISOString()
      };
    }
  }
  const state = writeDesktopChatSetupState({
    apiBaseUrl,
    registered: true,
    account,
    device,
    crypto: cryptoState,
    username: username || previousState.username || null,
    pinEnabled,
    lastServerConnectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  notifyDesktopChatRegistrationChanged(state);
  startDesktopChatReceiveRuntime({
    state,
    reason: 'registration-completed',
    quietOffline: true,
    notify: false
  }).catch(error => {
    mainLogger.warn('[CHAT] Chat receive startup after registration failed', {
      code: error.code || 'chat.receive_start_failed',
      error: error.message
    });
  });
  return {
    state,
    runtime: deriveDesktopChatRuntime(state),
    accountId,
    device
  };
}

async function startDesktopChatRegistration(input = {}) {
  let apiBaseUrl = DEFAULT_CHAT_API_BASE_URL;
  try {
    const username = normalizeDesktopChatUsernameInput(input.username);
    const password = normalizeDesktopChatPasswordInput(input.password);
    if (!username) throw new Error('Username is required to set up OpenX Chat.');
    if (!password) throw new Error('Password must be 10 to 128 characters.');
    const registrationRequest = buildDesktopChatRegistrationRequest(username, password);
    apiBaseUrl = normalizeDesktopChatApiBaseUrl(input.apiBaseUrl);
    mainLogger.info('[CHAT] Desktop requested chat account setup', {
      apiBaseUrl,
      username: redactChatUsername(username)
    });

    const availability = await desktopChatServerRequest(
      apiBaseUrl,
      `/account/username/${encodeURIComponent(username)}`,
      'GET'
    );
    const registeredRemotely = availability?.taken === true || availability?.available === false;
    const account = registeredRemotely
      ? await desktopChatServerRequest(apiBaseUrl, '/account/login', 'POST', registrationRequest)
      : await desktopChatServerRequest(apiBaseUrl, '/account/register', 'POST', registrationRequest);
    const completed = await completeDesktopChatRegistrationWithAccount({
      account,
      username,
      apiBaseUrl,
      pin: input.pin,
      previousState: readDesktopChatSetupState()
    });
    mainLogger.info('[CHAT] Desktop chat account setup completed', {
      apiBaseUrl,
      username: redactChatUsername(username),
      accountId: completed.accountId,
      deviceId: completed.device?.deviceId || null,
      chatReady: completed.runtime.chatReady
    });
    return {
      ...serializeDesktopChatSetupState(completed.state),
      registeredRemotely,
      canRegister: true,
      message: account.message || desktopChatReadyMessage(completed.runtime)
    };
  } catch (error) {
    mainLogger.warn('[CHAT] Chat account setup request failed', {
      apiBaseUrl,
      code: error.code || 'chat.registration_failed',
      error: error.message,
      details: error.details || null
    });
    return desktopChatRegistrationFailure(error, readDesktopChatSetupState());
  }
}

async function updateDesktopChatProfilePassword(input = {}) {
  await reconcileDesktopChatSetupState();
  const registered = getRegisteredDesktopChatContext();
  const username = normalizeDesktopChatUsernameInput(registered.state?.username || registered.state?.account?.username || '');
  if (!username) {
    const error = new Error('Chat profile username is missing. Sign in again from Chat settings.');
    error.code = 'chat.profile_missing';
    throw error;
  }
  const currentPassword = String(input.currentPassword || '');
  const newPassword = String(input.newPassword || '');
  const result = await desktopChatServerRequest(
    registered.apiBaseUrl,
    '/account/password/update',
    'POST',
    {
      accountId: registered.accountId,
      username,
      currentPassword,
      newPassword
    }
  );
  const account = isPlainObject(result.account) ? result.account : registered.state.account;
  const state = writeDesktopChatSetupState({
    ...registered.state,
    account: {
      ...(registered.state.account || {}),
      ...account
    },
    username: normalizeDesktopChatUsernameInput(account?.username || username) || username,
    updatedAt: new Date().toISOString()
  });
  notifyDesktopChatRegistrationChanged(state);
  return {
    success: true,
    message: normalizeDesktopChatText(result.message || 'Password updated successfully.', 160),
    state: serializeDesktopChatSetupState(state)
  };
}

function notifyDesktopChatRegistrationChanged(state = null) {
  if (!chatWindow || chatWindow.isDestroyed()) return;
  const payload = serializeDesktopChatSetupState(state || readDesktopChatSetupState());
  const send = () => {
    if (!chatWindow || chatWindow.isDestroyed()) return;
    chatWindow.webContents.send('desktopChat:registrationChanged', payload);
  };
  if (chatWindow.webContents.isLoading()) {
    chatWindow.webContents.once('did-finish-load', () => setTimeout(send, 50));
  } else {
    send();
  }
}

async function getDesktopChatConversationManager() {
  if (!desktopChatConversationManager) {
    desktopChatConversationManager = new ConversationManager({
      config: {
        storagePath: desktopChatConversationsPath(),
        defaultPageSize: 30,
        maxPageSize: 100,
        maxHistoryPerConversation: DESKTOP_CHAT_LOCAL_HISTORY_LIMIT
      }
    });
    desktopChatConversationReady = desktopChatConversationManager.initialize();
  }
  await desktopChatConversationReady;
  return desktopChatConversationManager;
}

async function getDesktopChatMessageManager(apiBaseUrl) {
  const normalizedApiBaseUrl = normalizeDesktopChatApiBaseUrl(apiBaseUrl);
  if (!desktopChatMessageManager || desktopChatMessageApiBaseUrl !== normalizedApiBaseUrl) {
    const cryptoManager = await getDesktopChatCryptoManager();
    desktopChatMessageApiBaseUrl = normalizedApiBaseUrl;
    desktopChatMessageManager = new MessageManager({
      config: {
        apiBaseUrl: normalizedApiBaseUrl,
        storagePath: desktopChatMessagesPath(),
        maxStoredMessages: DESKTOP_CHAT_LOCAL_HISTORY_LIMIT
      },
      crypto: cryptoManager,
      sessionResolver: buildDesktopChatRelationshipSessionKey
    });
    desktopChatMessageReady = desktopChatMessageManager.initialize();
  }
  await desktopChatMessageReady;
  return desktopChatMessageManager;
}

function normalizeDesktopChatText(value, maxLength = 1200) {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, '')
    .trim()
    .slice(0, maxLength);
}

function normalizeDesktopChatMessageStatus(value, fallback = '') {
  const status = normalizeDesktopChatText(value || fallback, 40).toLowerCase();
  if (['sending', 'sent', 'delivered', 'read', 'queued', 'failed'].includes(status)) return status;
  if (status === 'local-queue' || status === 'queuedcount') return 'queued';
  return '';
}

function summarizeDesktopChatDelivery(delivery = {}) {
  const result = isPlainObject(delivery.result) ? delivery.result : {};
  const deliveredCount = Math.max(0, Number(delivery.deliveredCount || result.deliveredCount || 0));
  const transport = normalizeDesktopChatMessageStatus(delivery.transport || '', '');
  if (deliveredCount > 0) return 'delivered';
  if (delivery.transport === 'local-queue') return 'queued';
  if (transport === 'sent') return 'sent';
  if (delivery.transport === 'http' || delivery.transport === 'websocket') return 'sent';
  return 'sent';
}

function serializeDesktopChatHistory(history = []) {
  return (Array.isArray(history) ? history : [])
    .map((entry, index) => {
      const text = normalizeDesktopChatText(entry.searchText || entry.text || entry.preview, 1200);
      if (!text) return null;
      const direction = entry.direction === 'outgoing' ? 'outgoing' : 'incoming';
      const status = direction === 'outgoing' && isPlainObject(entry.delivery)
        ? summarizeDesktopChatDelivery(entry.delivery)
        : normalizeDesktopChatMessageStatus(
          entry.status || entry.deliveryStatus,
          direction === 'outgoing' ? 'sent' : 'delivered'
        );
      return {
        messageId: normalizeDesktopChatText(entry.messageId || `message-${index}`, 100),
        text,
        direction,
        status,
        timestamp: entry.timestamp || entry.createdAt || new Date().toISOString()
      };
    })
    .filter(Boolean)
    .slice(-DESKTOP_CHAT_LOCAL_HISTORY_LIMIT);
}

function recordDesktopChatUiState(input = {}) {
  const visible = input.visible === true;
  const activeConversationId = normalizeDesktopChatSetupText(input.activeConversationId || input.conversationId || '', 100).toLowerCase();
  desktopChatUiState = {
    visible,
    activeConversationId: /^conv_[a-f0-9]{64}$/i.test(activeConversationId) ? activeConversationId : '',
    threadOpen: input.threadOpen === true,
    updatedAt: Date.now()
  };
  return {
    success: true,
    state: { ...desktopChatUiState }
  };
}

function isDesktopChatAppVisible() {
  return Boolean(
    desktopChatUiState.visible === true &&
    chatWindow &&
    !chatWindow.isDestroyed() &&
    chatWindow.isVisible()
  );
}

function serializeDesktopChatConversation(conversation = {}, history = []) {
  const metadata = conversation.metadata && typeof conversation.metadata === 'object' ? conversation.metadata : {};
  const safeHistory = serializeDesktopChatHistory(history);
  const lastHistory = safeHistory.length > 0 ? safeHistory[safeHistory.length - 1] : null;
  const title = normalizeDesktopChatText(metadata.title || metadata.name || conversation.title || 'New Chat', 80) || 'New Chat';
  const peerHandle = normalizeDesktopChatText(metadata.peerHandle || metadata.openxId || '', 120);
  const status = normalizeDesktopChatText(metadata.status || peerHandle || 'Local messages', 120) || 'Local messages';
  const serverStatus = normalizeDesktopChatText(metadata.serverStatus || '', 40) || 'local';
  const previewFallback = serverStatus === 'request-pending'
    ? 'Request sent'
    : 'No messages yet';
  const contactRequestId = normalizeDesktopChatText(metadata.contactRequestId || metadata.sourceRequestId || '', 100).toLowerCase();
  const recipientAccountId = normalizeDesktopChatText(metadata.recipientAccountId || metadata.peerAccountId || '', 100).toLowerCase();
  const senderAccountId = normalizeDesktopChatText(metadata.senderAccountId || '', 100).toLowerCase();
  return {
    conversationId: normalizeDesktopChatText(conversation.conversationId, 100),
    relationshipId: normalizeDesktopChatText(conversation.relationshipId, 100),
    title,
    status,
    peerHandle,
    peerType: normalizeDesktopChatText(metadata.peerType || 'openx', 40) || 'openx',
    serverStatus,
    contactRequestId: isDesktopChatRequestId(contactRequestId) ? contactRequestId : null,
    senderAccountId: isDesktopChatAccountId(senderAccountId) ? senderAccountId : null,
    recipientAccountId: isDesktopChatAccountId(recipientAccountId) ? recipientAccountId : null,
    preview: normalizeDesktopChatText(conversation.preview || lastHistory?.text || previewFallback, 140),
    unreadCount: Math.max(0, Number(conversation.unreadCount || 0)),
    pinned: conversation.pinned === true,
    muted: conversation.muted === true,
    lastMessageTimestamp: conversation.lastMessageTimestamp || lastHistory?.timestamp || conversation.updatedAt || conversation.createdAt || null,
    updatedAt: conversation.updatedAt || null,
    createdAt: conversation.createdAt || null,
    metadata: {
      title,
      status,
      peerHandle,
      peerType: normalizeDesktopChatText(metadata.peerType || 'openx', 40) || 'openx',
      serverStatus,
      contactRequestId: isDesktopChatRequestId(contactRequestId) ? contactRequestId : '',
      senderAccountId: isDesktopChatAccountId(senderAccountId) ? senderAccountId : '',
      recipientAccountId: isDesktopChatAccountId(recipientAccountId) ? recipientAccountId : '',
      peerAccountId: isDesktopChatAccountId(recipientAccountId) ? recipientAccountId : ''
    },
    history: safeHistory
  };
}

function notifyDesktopChatChanged(payload = {}) {
  if (!chatWindow || chatWindow.isDestroyed()) return;
  const message = {
    reason: normalizeDesktopChatText(payload.reason || 'updated', 40) || 'updated',
    conversationId: normalizeDesktopChatText(payload.conversationId || payload.conversation?.conversationId || '', 100),
    conversation: payload.conversation || null,
    updatedAt: new Date().toISOString()
  };
  const send = () => {
    if (!chatWindow || chatWindow.isDestroyed()) return;
    chatWindow.webContents.send('desktopChat:changed', message);
  };
  if (chatWindow.webContents.isLoading()) {
    chatWindow.webContents.once('did-finish-load', () => setTimeout(send, 50));
  } else {
    send();
  }
}

async function listDesktopChatConversations(input = {}) {
  const manager = await getDesktopChatConversationManager();
  const query = normalizeDesktopChatText(input.query, 120);
  const limit = Math.max(1, Math.min(50, Number(input.limit || 30)));
  const page = query
    ? await manager.search({ query, limit, includeArchived: false, includeMessages: false })
    : await manager.list({ limit, includeArchived: false });
  const conversations = (Array.isArray(page.items) ? page.items : [])
    .map(item => item.conversation || item)
    .filter(Boolean);
  const serialized = [];
  for (const conversation of conversations) {
    const history = await manager.storage.listHistory(conversation.conversationId);
    serialized.push(serializeDesktopChatConversation(conversation, history.slice(-6)));
  }
  return {
    success: true,
    count: serialized.length,
    conversations: serialized,
    nextCursor: page.nextCursor || null
  };
}

async function openDesktopChatConversation(input = {}) {
  const manager = await getDesktopChatConversationManager();
  const conversation = await manager.markRead(input.conversationId);
  const history = await manager.storage.listHistory(conversation.conversationId);
  return {
    success: true,
    conversation: serializeDesktopChatConversation(conversation, history)
  };
}

async function createDesktopChatConversation(input = {}) {
  const manager = await getDesktopChatConversationManager();
  const title = normalizeDesktopChatText(input.peerName || input.name || input.title || 'New Chat', 80) || 'New Chat';
  const peerHandle = normalizeDesktopChatUsernameInput(input.peerHandle || input.username || input.openxId || input.identifier);
  if (!peerHandle) throw new Error('Username is required to add a real OpenX Chat user.');
  await reconcileDesktopChatSetupState();
  const registered = getRegisteredDesktopChatContext();
  const lookup = await desktopChatServerRequest(
    registered.apiBaseUrl,
    '/discovery/lookup',
    'POST',
    {
      username: peerHandle,
      metadata: {
        source: 'openx-desktop-chat',
        intent: 'add-contact'
      }
    }
  );

  let request = null;
  let relationship = null;
  try {
    request = await desktopChatServerRequest(
      registered.apiBaseUrl,
      '/contact/request',
      'POST',
      {
        senderAccountId: registered.accountId,
        opaqueContactToken: lookup.opaqueContactToken,
        messagePreview: `Hi, this is ${os.hostname() || 'OpenX'} on OpenX Chat.`,
        metadata: {
          source: 'openx-desktop-chat',
          peerName: title,
          peerHandle,
          senderName: os.hostname() || 'OpenX Desktop'
        }
      }
    );
  } catch (error) {
    if (error.code === 'request.already_trusted' && isDesktopChatRelationshipId(error.details?.relationshipId)) {
      relationship = {
        relationshipId: error.details.relationshipId,
        accountA: error.details.accountA,
        accountB: error.details.accountB,
        status: 'Trusted'
      };
    } else if (error.code === 'request.duplicate' && isDesktopChatRequestId(error.details?.requestId)) {
      request = {
        requestId: error.details.requestId,
        status: 'Pending',
        senderAccountId: registered.accountId,
        recipientAccountId: '',
        metadata: { peerName: title, peerHandle }
      };
    } else if (error.code === 'request.unknown_account') {
      const notFound = new Error('No OpenX Chat account was found for that username.');
      notFound.code = 'chat.contact_not_found';
      throw notFound;
    } else {
      throw error;
    }
  }

  if (relationship) {
    const conversation = await ensureDesktopChatTrustedConversation(manager, relationship, registered.accountId, {
      title,
      peerName: title,
      peerHandle,
      peerType: 'username'
    });
    const history = await manager.storage.listHistory(conversation.conversationId);
    return {
      success: true,
      trusted: true,
      conversation: serializeDesktopChatConversation(conversation, history)
    };
  }

  if (!request?.requestId) throw new Error('Contact request could not be created.');
  const relationshipSeed = `pending:${registered.accountId}:${request.requestId}`;
  const conversation = await manager.createConversation({
    relationshipId: buildDesktopChatLocalRelationshipId(relationshipSeed),
    metadata: {
      title,
      name: title,
      peerHandle,
      peerType: 'username',
      status: 'Request sent',
      serverStatus: 'request-pending',
      requestStatus: normalizeDesktopChatSetupText(request.status || 'Pending', 40) || 'Pending',
      contactRequestId: request.requestId,
      senderAccountId: registered.accountId,
      recipientAccountId: normalizeDesktopChatSetupText(request.recipientAccountId || '', 100).toLowerCase(),
      apiBaseUrl: registered.apiBaseUrl,
      addedFrom: 'desktop-chat-server'
    }
  });
  const history = await manager.storage.listHistory(conversation.conversationId);
  return {
    success: true,
    pending: true,
    request: normalizeDesktopChatRequestRecord(request, registered.accountId),
    conversation: serializeDesktopChatConversation(conversation, history)
  };
}

async function updateDesktopChatConversation(input = {}) {
  const manager = await getDesktopChatConversationManager();
  const title = normalizeDesktopChatText(input.peerName || input.name || input.title, 80);
  const peerHandle = normalizeDesktopChatText(input.peerHandle || input.openxId || input.identifier, 120);
  const peerType = normalizeDesktopChatText(input.peerType || 'openx', 40) || 'openx';
  if (!title) throw new Error('Chat name is required.');
  if (!peerHandle) throw new Error('OpenX username or account id is required.');
  const conversation = await manager.updateConversationMetadata(input.conversationId, {
    title,
    name: title,
    peerHandle,
    peerType,
    status: peerHandle,
    updatedFrom: 'desktop-chat'
  });
  const history = await manager.storage.listHistory(conversation.conversationId);
  return {
    success: true,
    conversation: serializeDesktopChatConversation(conversation, history)
  };
}

async function deleteDesktopChatConversation(input = {}) {
  const manager = await getDesktopChatConversationManager();
  const conversation = await manager.deleteConversation(input.conversationId);
  return {
    success: true,
    conversationId: conversation.conversationId,
    deleted: true
  };
}

async function listDesktopChatContacts() {
  await reconcileDesktopChatSetupState();
  const registered = getRegisteredDesktopChatContext();
  const manager = await getDesktopChatConversationManager();
  const [incomingData, outgoingData, relationshipData] = await Promise.all([
    desktopChatServerRequest(
      registered.apiBaseUrl,
      `/contact/request/pending?accountId=${encodeURIComponent(registered.accountId)}`,
      'GET'
    ),
    desktopChatServerRequest(
      registered.apiBaseUrl,
      `/contact/request/outgoing?accountId=${encodeURIComponent(registered.accountId)}`,
      'GET'
    ),
    desktopChatServerRequest(
      registered.apiBaseUrl,
      `/contact/relationships?accountId=${encodeURIComponent(registered.accountId)}`,
      'GET'
    )
  ]);
  const incoming = (Array.isArray(incomingData.requests) ? incomingData.requests : [])
    .map(request => normalizeDesktopChatRequestRecord(request, registered.accountId))
    .filter(Boolean);
  const outgoing = (Array.isArray(outgoingData.requests) ? outgoingData.requests : [])
    .map(request => normalizeDesktopChatRequestRecord(request, registered.accountId))
    .filter(Boolean);
  const relationships = (Array.isArray(relationshipData.relationships) ? relationshipData.relationships : [])
    .map(relationship => normalizeDesktopChatRelationshipRecord(relationship, registered.accountId))
    .filter(Boolean);

  for (const relationship of relationships) {
    const requestMatch = [...incoming, ...outgoing].find(request => request.requestId === relationship.sourceRequestId);
    const conversation = await ensureDesktopChatTrustedConversation(manager, relationship, registered.accountId, {
      title: requestMatch?.title || 'OpenX user',
      peerName: requestMatch?.title || 'OpenX user',
      peerHandle: requestMatch?.peerHandle || relationship.peerAccountId,
      peerType: requestMatch?.peerHandle ? 'username' : 'account',
      contactRequestId: relationship.sourceRequestId || requestMatch?.requestId || '',
      addedFrom: 'desktop-chat-sync'
    });
    notifyDesktopChatChanged({ reason: 'synced', conversation: serializeDesktopChatConversation(conversation, await manager.storage.listHistory(conversation.conversationId).then(history => history.slice(-6))) });
  }

  return {
    success: true,
    registered: true,
    incoming,
    outgoing,
    relationships,
    count: incoming.length + outgoing.length + relationships.length,
    accountId: registered.accountId,
    apiBaseUrl: registered.apiBaseUrl
  };
}

async function acceptDesktopChatContactRequest(input = {}) {
  await reconcileDesktopChatSetupState();
  const registered = getRegisteredDesktopChatContext();
  const manager = await getDesktopChatConversationManager();
  const requestId = normalizeDesktopChatSetupText(input.requestId || '', 100).toLowerCase();
  if (!isDesktopChatRequestId(requestId)) throw new Error('Contact request id is invalid.');
  const result = await desktopChatServerRequest(
    registered.apiBaseUrl,
    '/contact/request/accept',
    'POST',
    {
      accountId: registered.accountId,
      requestId
    }
  );
  const request = normalizeDesktopChatRequestRecord(result.request, registered.accountId);
  const relationship = normalizeDesktopChatRelationshipRecord(result.relationship, registered.accountId);
  const conversation = await ensureDesktopChatTrustedConversation(manager, relationship, registered.accountId, {
    title: normalizeDesktopChatText(input.peerName || request?.title || 'OpenX user', 80) || 'OpenX user',
    peerName: normalizeDesktopChatText(input.peerName || request?.title || 'OpenX user', 80) || 'OpenX user',
    peerHandle: normalizeDesktopChatText(input.peerHandle || request?.peerHandle || relationship?.peerAccountId, 120),
    peerType: request?.peerHandle ? 'username' : 'account',
    contactRequestId: requestId,
    addedFrom: 'desktop-chat-accept'
  });
  const history = await manager.storage.listHistory(conversation.conversationId);
  return {
    success: true,
    request,
    relationship,
    conversation: serializeDesktopChatConversation(conversation, history)
  };
}

async function deleteDesktopChatContactRequest(input = {}) {
  await reconcileDesktopChatSetupState();
  const registered = getRegisteredDesktopChatContext();
  const requestId = normalizeDesktopChatSetupText(input.requestId || '', 100).toLowerCase();
  if (!isDesktopChatRequestId(requestId)) throw new Error('Contact request id is invalid.');
  const reason = normalizeDesktopChatText(input.reason || 'dismissed', 160) || 'dismissed';
  const request = await desktopChatServerRequest(
    registered.apiBaseUrl,
    '/contact/request/delete',
    'POST',
    {
      accountId: registered.accountId,
      requestId,
      reason
    }
  );
  return {
    success: true,
    request: normalizeDesktopChatRequestRecord(request, registered.accountId)
  };
}

async function cancelDesktopChatContactRequest(input = {}) {
  await reconcileDesktopChatSetupState();
  const registered = getRegisteredDesktopChatContext();
  const requestId = normalizeDesktopChatSetupText(input.requestId || '', 100).toLowerCase();
  if (!isDesktopChatRequestId(requestId)) throw new Error('Contact request id is invalid.');
  const reason = normalizeDesktopChatText(input.reason || 'cancelled', 160) || 'cancelled';
  const request = await desktopChatServerRequest(
    registered.apiBaseUrl,
    '/contact/request/cancel',
    'POST',
    {
      accountId: registered.accountId,
      requestId,
      reason
    }
  );
  return {
    success: true,
    request: normalizeDesktopChatRequestRecord(request, registered.accountId)
  };
}

function normalizeDesktopChatLookupKey(value) {
  return normalizeDesktopChatText(value || '', 120)
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9._ -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function desktopChatConversationLookupLabels(conversation = {}) {
  const metadata = isPlainObject(conversation.metadata) ? conversation.metadata : {};
  return [
    metadata.title,
    metadata.name,
    conversation.title,
    metadata.peerName,
    metadata.peerHandle,
    metadata.openxId,
    metadata.username,
    metadata.peerAccountId,
    metadata.recipientAccountId
  ]
    .map(value => normalizeDesktopChatLookupKey(value))
    .filter(Boolean);
}

function scoreDesktopChatConversationMatch(query, labels = []) {
  const target = normalizeDesktopChatLookupKey(query);
  if (!target) return 0;
  let score = 0;
  for (const label of labels) {
    if (label === target) score = Math.max(score, 100);
    else if (label.replace(/^@+/, '') === target) score = Math.max(score, 98);
    else if (label.startsWith(`${target} `) || label.startsWith(`${target}.`) || label.startsWith(`${target}_`)) score = Math.max(score, 86);
    else if (label.includes(target) && target.length >= 4) score = Math.max(score, 72);
  }
  return score;
}

async function findDesktopChatTrustedConversationByContact(contactName) {
  const query = normalizeDesktopChatLookupKey(contactName);
  if (!query) return null;
  const manager = await getDesktopChatConversationManager();
  const conversations = await manager.storage.listConversations();
  const matches = conversations
    .filter(conversation => {
      const metadata = isPlainObject(conversation.metadata) ? conversation.metadata : {};
      return !conversation.deleted &&
        normalizeDesktopChatSetupText(metadata.serverStatus || '', 40) === 'trusted' &&
        isDesktopChatRelationshipId(conversation.relationshipId);
    })
    .map(conversation => {
      const labels = desktopChatConversationLookupLabels(conversation);
      return {
        conversation,
        labels,
        score: scoreDesktopChatConversationMatch(query, labels)
      };
    })
    .filter(match => match.score >= 72)
    .sort((left, right) => right.score - left.score);

  if (matches.length === 0) return null;
  const bestScore = matches[0].score;
  const best = matches.filter(match => match.score === bestScore);
  if (best.length > 1) {
    const error = new Error(`I found more than one OpenX Chat contact matching ${contactName}. Open Chat and choose the person directly.`);
    error.code = 'chat.contact_ambiguous';
    error.details = {
      matches: best.slice(0, 5).map(match => serializeDesktopChatConversation(match.conversation, []))
    };
    throw error;
  }
  return matches[0].conversation;
}

async function sendDesktopChatMessageToContact(input = {}) {
  const requestedContactName = normalizeDesktopChatText(input.contactName || input.recipient || '', 80);
  const text = normalizeDesktopChatText(input.messageText || input.text || '', 1200);
  if (!requestedContactName) {
    const error = new Error('Tell me who to message in OpenX Chat.');
    error.code = 'chat.contact_required';
    throw error;
  }
  if (!text) {
    const error = new Error('Tell me what message to send.');
    error.code = 'chat.message_required';
    throw error;
  }

  await reconcileDesktopChatSetupState();
  getRegisteredDesktopChatContext();
  try {
    await listDesktopChatContacts();
  } catch (error) {
    if (!isDesktopChatServerUnavailableError(error)) {
      mainLogger.warn('[CHAT] Contact refresh before assistant message failed', {
        code: error.code || 'chat.contact_refresh_failed',
        error: error.message
      });
    }
  }

  const conversation = await findDesktopChatTrustedConversationByContact(requestedContactName);
  if (!conversation) {
    const error = new Error(`I could not find a trusted OpenX Chat contact named ${requestedContactName}. Open Chat and add or accept that person first.`);
    error.code = 'chat.contact_not_found';
    throw error;
  }

  const result = await sendDesktopChatMessage({
    conversationId: conversation.conversationId,
    text
  });
  notifyDesktopChatChanged({ reason: 'assistant-message', conversation: result.conversation });
  const displayName = result.conversation?.title || normalizeDesktopChatText(conversation.metadata?.title || requestedContactName, 80) || requestedContactName;
  return {
    success: true,
    data: {
      contactName: displayName,
      requestedContactName,
      messageText: text,
      platform: 'openx-chat',
      delivery: 'sent',
      conversationId: result.conversation?.conversationId || conversation.conversationId,
      relationshipId: result.conversation?.relationshipId || conversation.relationshipId
    }
  };
}

async function sendDesktopChatMessage(input = {}) {
  const manager = await getDesktopChatConversationManager();
  const text = normalizeDesktopChatText(input.text, 1200);
  if (!text) throw new Error('Message text is required.');
  let existing = await manager.getConversation(input.conversationId);
  let metadata = existing.metadata || {};
  let serverStatus = normalizeDesktopChatSetupText(metadata.serverStatus || '', 40);
  const messageId = `msg_${crypto.randomBytes(32).toString('hex')}`;
  let delivery = null;
  let messageStatus = 'sent';
  if (serverStatus === 'request-pending') {
    try {
      await listDesktopChatContacts();
      existing = await manager.getConversation(input.conversationId);
      metadata = existing.metadata || {};
      serverStatus = normalizeDesktopChatSetupText(metadata.serverStatus || '', 40);
    } catch (error) {
      if (!isDesktopChatServerUnavailableError(error)) {
        mainLogger.warn('[CHAT] Contact trust refresh before sending failed', {
          code: error.code || 'chat.contact_refresh_failed',
          error: error.message
        });
      }
    }
    if (serverStatus === 'request-pending') {
      const error = new Error('This person has not accepted your OpenX Chat request yet.');
      error.code = 'chat.request_pending';
      throw error;
    }
  }
  if (serverStatus === 'trusted') {
    try {
      await listDesktopChatContacts();
      existing = await manager.getConversation(input.conversationId);
      metadata = existing.metadata || {};
      serverStatus = normalizeDesktopChatSetupText(metadata.serverStatus || '', 40);
    } catch (error) {
      if (!isDesktopChatServerUnavailableError(error)) {
        mainLogger.warn('[CHAT] Contact trust refresh before sending failed', {
          code: error.code || 'chat.contact_refresh_failed',
          error: error.message
        });
      }
    }
    if (serverStatus !== 'trusted') {
      const error = new Error('This OpenX Chat contact is not trusted yet. Refresh Chat settings and try again.');
      error.code = 'chat.relationship_not_trusted';
      throw error;
    }
    await reconcileDesktopChatSetupState();
    const registered = getRegisteredDesktopChatContext();
    const recipientAccountId = normalizeDesktopChatSetupText(metadata.recipientAccountId || metadata.peerAccountId || '', 100).toLowerCase();
    if (!isDesktopChatRelationshipId(existing.relationshipId) || !isDesktopChatAccountId(recipientAccountId)) {
      const error = new Error('Trusted chat metadata is incomplete. Refresh Chat settings and try again.');
      error.code = 'chat.relationship_incomplete';
      throw error;
    }
    const messageManager = await getDesktopChatMessageManager(registered.apiBaseUrl);
    const sent = await messageManager.sendText({
      messageId,
      relationshipId: existing.relationshipId,
      senderAccountId: registered.accountId,
      senderDeviceId: registered.device.deviceId,
      recipientAccountId,
      recipientDeviceId: null,
      plaintext: text,
      metadata: {
        source: 'openx-desktop-chat',
        priority: 'Normal',
        previewStoredLocally: true
      }
    });
    delivery = sent.delivery || null;
    messageStatus = summarizeDesktopChatDelivery(delivery);
  }
  const conversation = await manager.addMessage({
    conversationId: input.conversationId,
    messageId,
    text,
    searchText: text,
    preview: text,
    direction: 'outgoing',
    unread: false,
    status: messageStatus,
    delivery,
    timestamp: new Date().toISOString()
  });
  const history = await manager.storage.listHistory(conversation.conversationId);
  return {
    success: true,
    delivery,
    conversation: serializeDesktopChatConversation(conversation, history)
  };
}

async function quickReplyDesktopChatMessage(input = {}) {
  const conversationId = normalizeDesktopChatSetupText(input.conversationId || '', 100).toLowerCase();
  const text = normalizeDesktopChatText(input.text || 'OK', 120);
  if (!/^conv_[a-f0-9]{64}$/i.test(conversationId)) {
    const error = new Error('Chat conversation is no longer available.');
    error.code = 'chat.conversation_invalid';
    throw error;
  }
  if (!text) {
    const error = new Error('Quick reply text is required.');
    error.code = 'chat.quick_reply_empty';
    throw error;
  }
  const result = await sendDesktopChatMessage({ conversationId, text });
  notifyDesktopChatChanged({ reason: 'quick-reply', conversation: result.conversation });
  return {
    success: true,
    data: {
      conversationId,
      text,
      delivery: 'sent',
      conversation: result.conversation
    }
  };
}

function desktopChatAccountFallbackLabel(accountId) {
  const id = normalizeDesktopChatSetupText(accountId || '', 100).toLowerCase();
  return isDesktopChatAccountId(id) ? `${id.slice(0, 10)}...${id.slice(-4)}` : 'OpenX user';
}

function desktopChatSenderInitials(senderName) {
  const words = String(senderName || 'Chat')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : String(words[0] || 'CH').slice(0, 2)).toUpperCase();
}

async function resolveDesktopChatAccountLabel(apiBaseUrl, accountId) {
  const normalized = normalizeDesktopChatSetupText(accountId || '', 100).toLowerCase();
  if (!isDesktopChatAccountId(normalized)) return 'OpenX user';
  try {
    const account = await desktopChatServerRequest(
      apiBaseUrl,
      `/account/${encodeURIComponent(normalized)}`,
      'GET',
      null,
      { quietOffline: true }
    );
    return normalizeDesktopChatText(account?.username || account?.displayName || '', 80)
      || desktopChatAccountFallbackLabel(normalized);
  } catch (error) {
    if (!isDesktopChatServerUnavailableError(error)) {
      mainLogger.warn('[CHAT] Could not resolve incoming message sender name', {
        accountId: normalized,
        code: error.code || 'chat.account_lookup_failed',
        error: error.message
      });
    }
    return desktopChatAccountFallbackLabel(normalized);
  }
}

function desktopChatConversationPeerLabel(conversation = {}, senderAccountId = '', localAccountId = '') {
  const metadata = isPlainObject(conversation.metadata) ? conversation.metadata : {};
  const title = normalizeDesktopChatText(metadata.title || metadata.name || conversation.title || '', 80);
  const peerHandle = normalizeDesktopChatText(metadata.peerHandle || '', 120);
  const peerAccountId = normalizeDesktopChatSetupText(metadata.peerAccountId || metadata.recipientAccountId || '', 100).toLowerCase();
  const sender = normalizeDesktopChatSetupText(senderAccountId || '', 100).toLowerCase();
  const owner = normalizeDesktopChatSetupText(localAccountId || '', 100).toLowerCase();
  if (sender && sender !== owner) {
    if (peerAccountId === sender && title) return title;
    if (peerHandle && !isDesktopChatAccountId(peerHandle)) return peerHandle;
    if (title && title !== 'OpenX user') return title;
  }
  return '';
}

function rememberDesktopChatIncomingMessage(messageId) {
  if (!messageId) return;
  desktopChatSeenIncomingMessages.set(messageId, Date.now());
  while (desktopChatSeenIncomingMessages.size > DESKTOP_CHAT_SEEN_INCOMING_LIMIT) {
    const oldest = [...desktopChatSeenIncomingMessages.entries()]
      .sort((left, right) => Number(left[1] || 0) - Number(right[1] || 0))[0];
    if (!oldest) break;
    desktopChatSeenIncomingMessages.delete(oldest[0]);
  }
}

function desktopChatHistoryHasMessage(history = [], messageId = '') {
  return (Array.isArray(history) ? history : []).some(entry => {
    return normalizeDesktopChatSetupText(entry.messageId || '', 100).toLowerCase() === messageId;
  });
}

function analyzeDesktopChatIncomingPrompt(preview = '', senderName = '') {
  const text = normalizeDesktopChatText(preview, DESKTOP_CHAT_NOTIFICATION_PREVIEW_MAX);
  const lower = text.toLowerCase();
  const sender = normalizeDesktopChatText(senderName || 'OpenX Chat', 80) || 'OpenX Chat';
  const asksToCall = /\b(?:call|phone|ring)\s+(?:me|back)\b|\b(?:call|phone|ring)\s+me\s+(?:now|immediately|urgent|asap)\b/.test(lower);
  const urgent = /\b(?:urgent|asap|immediately|emergency|right\s+now|quickly|fast)\b/.test(lower);
  const asksForReply = /\b(?:reply|respond|text|message)\s+(?:me|back)\b|\b(?:can|could|please)\s+you\b/.test(lower);
  if (!asksToCall && !urgent && !asksForReply) return null;

  const request = asksToCall
    ? `${sender} is asking you to call. Can I tell ${sender} OK?`
    : `${sender} sent: ${text}. Can I tell ${sender} OK?`;
  return {
    prompt: request,
    replyText: 'OK',
    kind: asksToCall ? 'call-request' : urgent ? 'urgent-message' : 'reply-request'
  };
}

function speakDesktopChatPrompt(prompt, metadata = {}) {
  const text = normalizeDesktopChatText(prompt, 260);
  if (!text || !textToSpeech || typeof textToSpeech.speak !== 'function') return false;
  try {
    if (readUiState().assistantMuted === true) return false;
    textToSpeech.speak(text);
    mainLogger.info('[CHAT] Assistant spoke an incoming chat prompt', {
      senderName: metadata.senderName || null,
      promptKind: metadata.kind || null
    });
    return true;
  } catch (error) {
    mainLogger.warn('[CHAT] Incoming chat TTS prompt failed', {
      code: error.code || 'chat.tts_failed',
      error: error.message
    });
    return false;
  }
}

function presentDesktopChatMessageInDynamicIsland(message = {}) {
  if (!voiceOverlay || typeof voiceOverlay.displayAssistantResult !== 'function') return false;
  if (isDesktopChatAppVisible()) {
    mainLogger.info('[CHAT] Chat message notification suppressed because Chat is open', {
      conversationId: normalizeDesktopChatSetupText(message.conversationId || '', 100) || null
    });
    return false;
  }
  const senderName = normalizeDesktopChatText(message.senderName || 'OpenX Chat', 80) || 'OpenX Chat';
  const preview = normalizeDesktopChatText(message.preview || 'New message', DESKTOP_CHAT_NOTIFICATION_PREVIEW_MAX) || 'New message';
  const conversationId = normalizeDesktopChatSetupText(message.conversationId || '', 100);
  const messageId = normalizeDesktopChatSetupText(message.messageId || '', 100);
  const assistantPrompt = analyzeDesktopChatIncomingPrompt(preview, senderName);
  const actions = assistantPrompt && /^conv_[a-f0-9]{64}$/i.test(conversationId)
    ? [
        {
          id: 'reply-ok',
          label: 'Tell OK',
          kind: 'desktop-chat-reply',
          conversationId,
          text: assistantPrompt.replyText,
          primary: true
        },
        {
          id: 'open-chat',
          label: 'Open Chat',
          kind: 'open-chat',
          conversationId
        },
        {
          id: 'dismiss',
          label: 'Dismiss',
          kind: 'dismiss'
        }
      ]
    : [{
        id: 'ok',
        label: 'OK',
        kind: 'dismiss',
        primary: true
      }];
  if (assistantPrompt) {
    speakDesktopChatPrompt(assistantPrompt.prompt, {
      senderName,
      kind: assistantPrompt.kind
    });
  }
  try {
    voiceOverlay.displayAssistantResult({
      success: true,
      intent: 'desktopChat.message',
      response: assistantPrompt?.prompt || preview,
      data: {
        chatMessage: {
          senderName,
          preview,
          conversationId,
          messageId,
          promptKind: assistantPrompt?.kind || null
        },
        actions,
        resultEntries: [{
          index: 1,
          name: senderName,
          type: 'OpenX Chat',
          location: 'New message',
          snippet: preview
        }]
      },
      ui: {
        icon: desktopChatSenderInitials(senderName),
        previewStatus: `Chat from ${senderName}`.slice(0, 80),
        preExpandDelayMs: 450,
        autoHideMs: 15000,
        persistUntilAction: false
      }
    });
    return true;
  } catch (error) {
    mainLogger.warn('[CHAT] Dynamic Island chat notification failed', {
      error: error.message
    });
    return false;
  }
}

async function ensureDesktopChatConversationForEnvelope(manager, envelope = {}, registered = {}, senderName = '') {
  const metadata = isPlainObject(envelope.metadata) ? envelope.metadata : {};
  const relationshipId = normalizeDesktopChatSetupText(envelope.relationshipId || metadata.relationshipId || '', 100).toLowerCase();
  if (!isDesktopChatRelationshipId(relationshipId)) {
    const error = new Error('Incoming chat message relationship is invalid.');
    error.code = 'chat.relationship_invalid';
    throw error;
  }
  const senderAccountId = normalizeDesktopChatSetupText(envelope.senderAccountId || metadata.senderAccountId || '', 100).toLowerCase();
  const recipientAccountId = normalizeDesktopChatSetupText(envelope.recipientAccountId || metadata.recipientAccountId || '', 100).toLowerCase();
  const localAccountId = normalizeDesktopChatSetupText(registered.accountId || '', 100).toLowerCase();
  const peerAccountId = senderAccountId === localAccountId ? recipientAccountId : senderAccountId;
  const safePeerAccountId = isDesktopChatAccountId(peerAccountId) ? peerAccountId : '';
  const existing = await manager.storage.getConversationByRelationship(relationshipId);
  if (existing) return existing;

  const title = normalizeDesktopChatText(senderName || desktopChatAccountFallbackLabel(safePeerAccountId), 80) || 'OpenX user';
  return manager.createConversation({
    relationshipId,
    metadata: {
      title,
      name: title,
      status: 'Trusted',
      peerHandle: safePeerAccountId || title,
      peerType: safePeerAccountId ? 'account' : 'openx',
      serverStatus: 'trusted',
      senderAccountId: localAccountId,
      recipientAccountId: safePeerAccountId,
      peerAccountId: safePeerAccountId,
      addedFrom: 'desktop-chat-incoming'
    }
  });
}

async function acknowledgeDesktopChatSequence(registered = {}, sequence) {
  const deviceId = normalizeDesktopChatSetupText(registered.device?.deviceId || '', 100).toLowerCase();
  const highestContiguousSequence = Math.max(0, Math.floor(Number(sequence) || 0));
  if (!isDesktopChatDeviceId(deviceId) || highestContiguousSequence <= 0) return false;
  await desktopChatServerRequest(
    registered.apiBaseUrl,
    '/sync/ack',
    'POST',
    {
      deviceId,
      highestContiguousSequence
    },
    { quietOffline: true }
  );
  writeDesktopChatSyncCursor(deviceId, highestContiguousSequence);
  return true;
}

async function acknowledgeDesktopChatSequenceIfContiguous(registered = {}, sequence) {
  const deviceId = normalizeDesktopChatSetupText(registered.device?.deviceId || '', 100).toLowerCase();
  const receivedSequence = Math.max(0, Math.floor(Number(sequence) || 0));
  if (!isDesktopChatDeviceId(deviceId) || receivedSequence <= 0) return false;
  const cursor = getDesktopChatSyncCursor(deviceId);
  if (receivedSequence <= cursor.lastAck) return false;
  if (receivedSequence === cursor.lastAck + 1) {
    return acknowledgeDesktopChatSequence(registered, receivedSequence);
  }
  syncDesktopChatMailbox({ reason: 'sequence-gap', notify: true, scheduleNext: true }).catch(error => {
    mainLogger.warn('[CHAT] Mailbox sync after live message gap failed', {
      code: error.code || 'chat.sync_failed',
      error: error.message
    });
  });
  return false;
}

async function processDesktopChatIncomingEnvelope(envelope = {}, options = {}) {
  if (!isPlainObject(envelope)) return null;
  const messageId = normalizeDesktopChatSetupText(envelope.messageId || envelope.metadata?.messageId || '', 100).toLowerCase();
  if (!/^msg_[a-f0-9]{64}$/i.test(messageId)) return null;
  const registered = options.registered || getRegisteredDesktopChatContext({ requireReady: false });
  if (!registered.runtime?.chatReady) return null;
  const localAccountId = normalizeDesktopChatSetupText(registered.accountId || '', 100).toLowerCase();
  const senderAccountId = normalizeDesktopChatSetupText(envelope.senderAccountId || envelope.metadata?.senderAccountId || '', 100).toLowerCase();
  const recipientAccountId = normalizeDesktopChatSetupText(envelope.recipientAccountId || envelope.metadata?.recipientAccountId || '', 100).toLowerCase();
  if (senderAccountId !== localAccountId && recipientAccountId !== localAccountId) return null;
  if (desktopChatSeenIncomingMessages.has(messageId)) return { success: true, duplicate: true, messageId };

  const manager = await getDesktopChatConversationManager();
  const existing = await manager.storage.getConversationByRelationship(envelope.relationshipId || envelope.metadata?.relationshipId || '');
  const direction = senderAccountId === localAccountId ? 'outgoing' : 'incoming';
  const peerAccountId = direction === 'outgoing' ? recipientAccountId : senderAccountId;
  const peerName = desktopChatConversationPeerLabel(existing || {}, peerAccountId, localAccountId)
    || await resolveDesktopChatAccountLabel(registered.apiBaseUrl, peerAccountId);
  const senderName = direction === 'incoming'
    ? peerName
    : (normalizeDesktopChatText(registered.state?.username || registered.state?.account?.username || '', 80) || 'You');
  let conversation = await ensureDesktopChatConversationForEnvelope(manager, envelope, registered, peerName);
  const historyBefore = await manager.storage.listHistory(conversation.conversationId);
  const duplicate = desktopChatHistoryHasMessage(historyBefore, messageId);
  const preview = await decodeDesktopChatIncomingMessageText(envelope, {
    registered,
    conversation: existing || conversation,
    localAccountId,
    relationshipId: envelope.relationshipId || envelope.metadata?.relationshipId || '',
    senderAccountId,
    recipientAccountId
  }) || 'Encrypted message';
  if (!duplicate) {
    conversation = await manager.addMessage({
      conversationId: conversation.conversationId,
      messageId,
      text: preview,
      searchText: preview,
      preview,
      direction,
      unread: direction !== 'outgoing',
      senderAccountId,
      senderDeviceId: normalizeDesktopChatSetupText(envelope.senderDeviceId || envelope.metadata?.senderDeviceId || '', 100) || null,
      recipientAccountId,
      recipientDeviceId: normalizeDesktopChatSetupText(envelope.recipientDeviceId || envelope.metadata?.recipientDeviceId || '', 100) || null,
      timestamp: envelope.timestamp || envelope.metadata?.timestamp || new Date().toISOString()
    });
  }
  rememberDesktopChatIncomingMessage(messageId);
  const history = await manager.storage.listHistory(conversation.conversationId);
  const serialized = serializeDesktopChatConversation(conversation, history);
  notifyDesktopChatChanged({
    reason: direction === 'outgoing' ? 'synced-message' : 'incoming-message',
    conversation: serialized
  });
  if (!duplicate && direction !== 'outgoing' && serialized.muted !== true && options.notify !== false) {
    presentDesktopChatMessageInDynamicIsland({
      senderName,
      preview,
      conversationId: serialized.conversationId,
      messageId
    });
  }
  return {
    success: true,
    duplicate,
    direction,
    messageId,
    conversation: serialized,
    mailboxSequence: Number(envelope.mailboxSequence || 0)
  };
}

function extractDesktopChatSyncEnvelopes(payload = {}) {
  const candidates = [
    payload.envelopes,
    payload.sync?.envelopes,
    payload.backgroundSync?.sync?.envelopes,
    payload.data?.envelopes
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function jitterDesktopChatDelay(delayMs) {
  const delay = Math.max(1000, Number(delayMs) || DESKTOP_CHAT_SYNC_INTERVAL_MS);
  const spread = Math.min(5000, Math.floor(delay * 0.15));
  if (spread <= 0) return delay;
  return delay + Math.floor(Math.random() * spread);
}

function getDesktopChatNextSyncDelay(envelopeCount = 0, hasMore = false) {
  if (hasMore) {
    desktopChatSyncIdleCount = 0;
    return 1000;
  }
  if (envelopeCount > 0) {
    desktopChatSyncIdleCount = 0;
    return DESKTOP_CHAT_SYNC_ACTIVE_INTERVAL_MS;
  }
  desktopChatSyncIdleCount = Math.min(4, desktopChatSyncIdleCount + 1);
  return Math.min(
    DESKTOP_CHAT_SYNC_IDLE_MAX_MS,
    DESKTOP_CHAT_SYNC_INTERVAL_MS * desktopChatSyncIdleCount
  );
}

function getDesktopChatFailureSyncDelay() {
  desktopChatSyncFailureCount = Math.min(5, desktopChatSyncFailureCount + 1);
  return Math.min(
    DESKTOP_CHAT_SYNC_FAILURE_MAX_MS,
    DESKTOP_CHAT_RECONNECT_MAX_MS * (2 ** Math.max(0, desktopChatSyncFailureCount - 1))
  );
}

function scheduleDesktopChatMailboxSync(delayMs = DESKTOP_CHAT_SYNC_INTERVAL_MS) {
  if (desktopChatSyncTimer) clearTimeout(desktopChatSyncTimer);
  desktopChatSyncTimer = setTimeout(() => {
    desktopChatSyncTimer = null;
    syncDesktopChatMailbox({ reason: 'poll', notify: true, scheduleNext: true }).catch(() => {});
  }, jitterDesktopChatDelay(delayMs));
  desktopChatSyncTimer.unref?.();
}

async function syncDesktopChatMailbox(options = {}) {
  if (desktopChatSyncInFlight) return { success: true, skipped: true, reason: 'sync-in-flight' };
  let registered = null;
  desktopChatSyncInFlight = true;
  try {
    registered = getRegisteredDesktopChatContext({ requireReady: false });
    if (!registered.runtime?.chatReady) return { success: true, skipped: true, reason: 'chat-not-ready' };
    const deviceId = normalizeDesktopChatSetupText(registered.device?.deviceId || '', 100).toLowerCase();
    const cursor = getDesktopChatSyncCursor(deviceId);
    const afterSequence = Math.max(0, Number(cursor.lastAck || 0) - DESKTOP_CHAT_SYNC_OVERLAP);
    const payload = await desktopChatServerRequest(
      registered.apiBaseUrl,
      `/sync?deviceId=${encodeURIComponent(deviceId)}&afterSequence=${encodeURIComponent(String(afterSequence))}&limit=50`,
      'GET',
      null,
      { quietOffline: true, timeoutMs: DESKTOP_CHAT_SYNC_REQUEST_TIMEOUT_MS }
    );
    const envelopes = extractDesktopChatSyncEnvelopes(payload);
    for (const envelope of envelopes) {
      await processDesktopChatIncomingEnvelope(envelope, {
        registered,
        notify: options.notify !== false
      });
    }
    const suggestedAck = Math.max(
      Number(payload.suggestedAck || 0),
      Number(payload.highestContiguousSequence || 0)
    );
    if (suggestedAck > cursor.lastAck) {
      if (envelopes.length) await acknowledgeDesktopChatSequence(registered, suggestedAck);
      else writeDesktopChatSyncCursor(deviceId, suggestedAck);
    }
    desktopChatSyncFailureCount = 0;
    const nextDelay = getDesktopChatNextSyncDelay(envelopes.length, payload.hasMore === true);
    if (options.scheduleNext !== false) scheduleDesktopChatMailboxSync(nextDelay);
    return {
      success: true,
      envelopes: envelopes.length,
      highestAck: suggestedAck
    };
  } catch (error) {
    if (isDesktopChatServerUnavailableError(error)) {
      logDesktopChatOfflineInfo('[CHAT] Chat Server is offline; message sync will retry', {
        next: 'incoming OpenX Chat messages will sync when the server is reachable'
      });
    } else {
      mainLogger.warn('[CHAT] Chat message sync failed', {
        code: error.code || 'chat.sync_failed',
        error: error.message
      });
    }
    if (options.scheduleNext !== false) scheduleDesktopChatMailboxSync(getDesktopChatFailureSyncDelay());
    throw error;
  } finally {
    desktopChatSyncInFlight = false;
  }
}

function stopDesktopChatReceiveRuntime() {
  if (desktopChatReconnectTimer) clearTimeout(desktopChatReconnectTimer);
  if (desktopChatSyncTimer) clearTimeout(desktopChatSyncTimer);
  desktopChatReconnectTimer = null;
  desktopChatSyncTimer = null;
  desktopChatSyncInFlight = false;
  desktopChatSyncFailureCount = 0;
  desktopChatSyncIdleCount = 0;
  const socket = desktopChatSocket;
  desktopChatSocket = null;
  desktopChatSocketContext = null;
  if (!socket) return;
  try {
    socket.removeAllListeners();
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close(1000, 'desktop-chat-shutdown');
    } else {
      socket.terminate?.();
    }
  } catch (_) {}
}

function scheduleDesktopChatReconnect(reason = 'socket-closed') {
  if (desktopChatReconnectTimer || !desktopChatSocketContext) return;
  const context = desktopChatSocketContext;
  context.reconnectAttempts = Math.max(0, Number(context.reconnectAttempts || 0)) + 1;
  const delay = Math.min(
    DESKTOP_CHAT_RECONNECT_MAX_MS,
    DESKTOP_CHAT_RECONNECT_MIN_MS * (2 ** Math.min(5, context.reconnectAttempts - 1))
  );
  desktopChatReconnectTimer = setTimeout(() => {
    desktopChatReconnectTimer = null;
    startDesktopChatReceiveRuntime({
      reason: `reconnect:${reason}`,
      quietOffline: true,
      notify: true,
      reconnectAttempts: context.reconnectAttempts
    }).catch(error => {
      if (!isDesktopChatServerUnavailableError(error)) {
        mainLogger.warn('[CHAT] Chat live receive reconnect failed', {
          code: error.code || 'chat.websocket_failed',
          error: error.message
        });
      }
    });
  }, delay);
  desktopChatReconnectTimer.unref?.();
}

function sendDesktopChatSocketEvent(type, data = {}) {
  if (!desktopChatSocket || desktopChatSocket.readyState !== WebSocket.OPEN) return false;
  desktopChatSocket.send(JSON.stringify({
    type,
    data,
    timestamp: new Date().toISOString()
  }));
  return true;
}

async function handleDesktopChatSocketMessage(raw, context = {}) {
  let payload = null;
  try {
    payload = JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw || '{}'));
  } catch (error) {
    mainLogger.warn('[CHAT] Ignored malformed Chat Server WebSocket message', { error: error.message });
    return;
  }
  const type = normalizeDesktopChatSetupText(payload.type || '', 80);
  const data = isPlainObject(payload.data) ? payload.data : {};
  if (type === 'connection:identified') {
    if (desktopChatSocketContext) desktopChatSocketContext.reconnectAttempts = 0;
    mainLogger.info('[CHAT] Desktop chat live receive connected', {
      apiBaseUrl: context.apiBaseUrl,
      accountId: context.accountId,
      deviceId: context.deviceId
    });
    syncDesktopChatMailbox({ reason: 'websocket-identified', notify: true, scheduleNext: true }).catch(() => {});
    return;
  }
  if (type === 'message:receive') {
    const result = await processDesktopChatIncomingEnvelope(data.envelope, {
      registered: context.registered,
      notify: true
    });
    if (result?.mailboxSequence) {
      await acknowledgeDesktopChatSequenceIfContiguous(context.registered, result.mailboxSequence);
    }
    return;
  }
  if (type === 'connection:wake:completed' || type === 'connection:recovery:completed') {
    for (const envelope of extractDesktopChatSyncEnvelopes(data)) {
      await processDesktopChatIncomingEnvelope(envelope, {
        registered: context.registered,
        notify: true
      });
    }
  }
}

async function startDesktopChatReceiveRuntime(options = {}) {
  const state = options.state
    ? normalizeDesktopChatSetupState(options.state)
    : await reconcileDesktopChatSetupState({ quietOffline: options.quietOffline !== false });
  const runtime = deriveDesktopChatRuntime(state);
  if (!runtime.chatReady) {
    if (desktopChatSyncTimer) clearTimeout(desktopChatSyncTimer);
    desktopChatSyncTimer = null;
    return { success: true, started: false, reason: runtime.blockingReason || 'chat-not-ready' };
  }
  const registered = {
    state,
    runtime,
    apiBaseUrl: normalizeDesktopChatApiBaseUrl(state.apiBaseUrl),
    accountId: normalizeDesktopChatSetupText(state.account?.accountId || '', 100).toLowerCase(),
    device: state.device
  };
  const deviceId = normalizeDesktopChatSetupText(registered.device?.deviceId || '', 100).toLowerCase();
  const socketUrl = desktopChatWebSocketUrl(registered.apiBaseUrl);
  if (
    desktopChatSocket
    && [WebSocket.OPEN, WebSocket.CONNECTING].includes(desktopChatSocket.readyState)
    && desktopChatSocketContext?.socketUrl === socketUrl
    && desktopChatSocketContext?.deviceId === deviceId
  ) {
    if (!desktopChatSyncTimer) scheduleDesktopChatMailboxSync();
    return { success: true, started: true, reused: true };
  }

  const previousSocket = desktopChatSocket;
  if (previousSocket) {
    try {
      previousSocket.removeAllListeners();
      previousSocket.close(1000, 'desktop-chat-reconnect');
    } catch (_) {}
  }
  desktopChatSocket = null;
  desktopChatSocketContext = {
    socketUrl,
    apiBaseUrl: registered.apiBaseUrl,
    accountId: registered.accountId,
    deviceId,
    registered,
    reconnectAttempts: Math.max(0, Number(options.reconnectAttempts || 0))
  };

  const socket = new WebSocket(socketUrl, {
    handshakeTimeout: Math.min(DESKTOP_CHAT_REQUEST_TIMEOUT_MS, 10000)
  });
  desktopChatSocket = socket;
  socket.on('open', () => {
    sendDesktopChatSocketEvent('connection:ready', {
      protocolVersion: 'openx-chat-desktop',
      client: 'openx-desktop'
    });
    sendDesktopChatSocketEvent('connection:identify', {
      accountId: registered.accountId,
      deviceId,
      platform: process.platform === 'win32' ? 'windows' : process.platform,
      client: 'openx-desktop'
    });
  });
  socket.on('message', data => {
    handleDesktopChatSocketMessage(data, desktopChatSocketContext || {}).catch(error => {
      mainLogger.warn('[CHAT] Incoming chat message handling failed', {
        code: error.code || 'chat.incoming_failed',
        error: error.message
      });
    });
  });
  socket.on('close', (code, reason) => {
    if (desktopChatSocket === socket) desktopChatSocket = null;
    mainLogger.info('[CHAT] Desktop chat live receive disconnected', {
      code,
      reason: String(reason || '').slice(0, 80)
    });
    scheduleDesktopChatReconnect('socket-close');
  });
  socket.on('error', error => {
    mainLogger.warn('[CHAT] Desktop chat live receive connection failed', {
      code: error.code || 'chat.websocket_failed',
      error: error.message
    });
  });
  scheduleDesktopChatMailboxSync(1000);
  return { success: true, started: true, socketUrl };
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

function clearVoiceResumeRecoveryTimer() {
  if (voiceResumeRecoveryTimer) {
    clearTimeout(voiceResumeRecoveryTimer);
    voiceResumeRecoveryTimer = null;
  }
}

function resetVoiceRuntimeAfterPowerEvent(reason = 'system-power-event') {
  voiceStartInFlight = false;
  voiceSpeakingStopTapAt = 0;
  voiceSpeakingStopSessionId = null;

  try {
    if (voiceSessionManager?.isActive?.()) {
      voiceSessionManager.cancelSession(reason);
    } else if (voiceSessionManager?.isBusy?.()) {
      voiceSessionManager.reset();
    }
  } catch (error) {
    mainLogger.warn('Voice session reset after power event failed', {
      reason,
      error: error.message
    });
  }

  destroyVoiceCaptureWindow();
}

function scheduleVoiceResumeRecovery(reason = 'system-resume') {
  clearVoiceResumeRecoveryTimer();
  resetVoiceRuntimeAfterPowerEvent(reason);
  voiceResumeRecoveryTimer = setTimeout(() => {
    voiceResumeRecoveryTimer = null;
    if (cleanupFinished || cleanupPromise) return;
    mainLogger.info('Voice runtime recovery after system resume started', { reason });
    scheduleVoiceRuntimePrewarm(reason, VOICE_RESUME_RUNTIME_PREWARM_DELAY_MS);
    scheduleVoiceResourceWarmup(reason, VOICE_RESUME_RESOURCE_WARMUP_DELAY_MS);
  }, VOICE_RESUME_RUNTIME_PREWARM_DELAY_MS);
  if (typeof voiceResumeRecoveryTimer.unref === 'function') {
    voiceResumeRecoveryTimer.unref();
  }
}

function destroyVoiceCaptureWindow() {
  clearVoiceResumeRecoveryTimer();
  if (voiceCaptureWarmupTimer) {
    clearTimeout(voiceCaptureWarmupTimer);
    voiceCaptureWarmupTimer = null;
  }
  if (voiceResourceWarmupTimer) {
    clearTimeout(voiceResourceWarmupTimer);
    voiceResourceWarmupTimer = null;
  }
  stopVoiceCaptureStream('runtime-cleanup');
  if (voiceCaptureWindow && !voiceCaptureWindow.isDestroyed()) {
    voiceCaptureWindow.destroy();
  }
  voiceCaptureWindow = null;
  voiceCaptureReady = false;
  voiceCaptureShouldRun = false;
  voiceCaptureStartOptions = null;
  voiceStartInFlight = false;
}

function createDesktopMicrophoneBackend() {
  const captureBackend = {
    opened: false,
    capturing: false,
    configuration: null,
    onFrame: null,
    open: ({ configuration, onFrame } = {}) => {
      captureBackend.opened = true;
      captureBackend.configuration = configuration || null;
      captureBackend.onFrame = typeof onFrame === 'function' ? onFrame : null;
      voiceCaptureFrameReceiver = captureBackend.onFrame;
      createVoiceCaptureWindow();
    },
    start: ({ configuration } = {}) => {
      captureBackend.capturing = true;
      captureBackend.configuration = configuration || captureBackend.configuration;
      voiceCaptureFrameReceiver = captureBackend.onFrame;
      resetVoiceCaptureFrameStats();
      startVoiceCaptureStream({
        sampleRate: captureBackend.configuration?.sampleRate || 16000,
        channels: captureBackend.configuration?.channels || 1
      });
    },
    stop: () => {
      captureBackend.capturing = false;
      stopVoiceCaptureStream('audio-stop');
    },
    pause: () => {
      captureBackend.capturing = false;
      stopVoiceCaptureStream('audio-pause');
    },
    resume: () => {
      captureBackend.capturing = true;
      voiceCaptureFrameReceiver = captureBackend.onFrame;
      resetVoiceCaptureFrameStats();
      startVoiceCaptureStream({
        sampleRate: captureBackend.configuration?.sampleRate || 16000,
        channels: captureBackend.configuration?.channels || 1
      });
    },
    close: () => {
      captureBackend.opened = false;
      captureBackend.capturing = false;
      if (voiceCaptureFrameReceiver === captureBackend.onFrame) {
        voiceCaptureFrameReceiver = null;
      }
      captureBackend.onFrame = null;
      stopVoiceCaptureStream('audio-close');
    }
  };
  return captureBackend;
}

function hasCompleteParakeetModel(modelPath) {
  if (!modelPath || typeof modelPath !== 'string') return false;
  try {
    return fs.existsSync(modelPath) &&
      REQUIRED_PARAKEET_MODEL_FILES.every(fileName => fs.existsSync(path.join(modelPath, fileName)));
  } catch (_) {
    return false;
  }
}

function uniqueExistingPathCandidates(candidates = []) {
  const seen = new Set();
  const unique = [];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = path.resolve(String(candidate));
    const key = resolved.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(resolved);
  }
  return unique;
}

function resolveDesktopSttModelPath() {
  const configuredPath = runtimeConfig?.voice?.recognition?.modelPath || runtimeConfig?.voice?.stt?.modelPath;
  const envPath = process.env.OPENX_STT_MODEL_PATH;
  const executableDir = process.execPath ? path.dirname(process.execPath) : '';
  const appPath = typeof app.getAppPath === 'function' ? app.getAppPath() : '';
  const appPathDir = appPath && path.extname(appPath).toLowerCase() === '.asar'
    ? path.dirname(appPath)
    : appPath;
  const candidateRoots = uniqueExistingPathCandidates([
    envPath,
    configuredPath,
    path.join(__dirname, '..', '..', '..', 'models', 'parakeet'),
    path.join(process.cwd(), 'models', 'parakeet'),
    appPath ? path.join(appPath, 'models', 'parakeet') : '',
    appPathDir ? path.join(appPathDir, 'models', 'parakeet') : '',
    process.resourcesPath ? path.join(process.resourcesPath, 'models', 'parakeet') : '',
    process.resourcesPath ? path.join(path.dirname(process.resourcesPath), 'models', 'parakeet') : '',
    executableDir ? path.join(executableDir, 'models', 'parakeet') : ''
  ]);
  const modelPath = candidateRoots.find(hasCompleteParakeetModel);
  if (modelPath) {
    mainLogger.info('[Voice Models] STT model location validated', {
      model: 'nvidia-parakeet-tdt-v3',
      engine: 'parakeet',
      runtime: 'sherpa-onnx',
      files: REQUIRED_PARAKEET_MODEL_FILES.length,
      sourceCount: candidateRoots.length
    });
    return modelPath;
  }

  const fallbackPath = path.resolve(__dirname, '..', '..', '..', 'models', 'parakeet');
  mainLogger.warn('[Voice Models] STT model location could not be validated; using fallback candidate', {
    model: 'nvidia-parakeet-tdt-v3',
    engine: 'parakeet',
    runtime: 'sherpa-onnx',
    checked: candidateRoots.length
  });
  return fallbackPath;
}

function modelPathStatus(modelPath) {
  return hasCompleteParakeetModel(modelPath) ? 'validated' : 'fallback';
}

function buildVoiceSttSummary(modelPath) {
  return {
    role: 'speech-to-text',
    engine: 'parakeet',
    model: 'nvidia-parakeet-tdt-v3',
    runtime: 'sherpa-onnx',
    provider: runtimeConfig?.voice?.stt?.gpuEnabled === true ? 'cuda' : 'cpu',
    language: runtimeConfig?.voice?.stt?.language || runtimeConfig?.voice?.recognition?.language || 'en-US',
    modelStatus: modelPathStatus(modelPath),
    files: REQUIRED_PARAKEET_MODEL_FILES.length,
    preload: shouldPrewarmVoiceResources() ? 'idle-warmup' : 'first-use'
  };
}

function logVoiceModelLoadingOnce(reason = 'startup') {
  if (voiceModelLoadingLogged) return;
  voiceModelLoadingLogged = true;
  mainLogger.info('[Voice Models] Loading assistant voice models', {
    reason,
    stt: voiceSttSummary || 'pending',
    tts: voiceTtsSummary || 'pending'
  });
}

function logVoiceModelSummaryOnce(reason = 'startup') {
  if (voiceModelSummaryLogged) return;
  if (!voiceSttSummary || !voiceTtsSummary) return;
  voiceModelSummaryLogged = true;
  mainLogger.info('[Voice Models] Assistant model summary', {
    reason,
    stt: voiceSttSummary,
    tts: voiceTtsSummary
  });
}

function createDesktopVoiceResources() {
  const microphoneDevice = {
    id: 'desktop-default-microphone',
    displayName: 'Default microphone',
    isDefault: true,
    connected: true,
    sampleRates: [16000],
    channels: 1,
    kind: 'audioinput'
  };
  const permissionProvider = {
    getMicrophonePermissionStatus: () => ({
      granted: true,
      state: 'granted',
      reason: 'Desktop voice capture is enabled.'
    }),
    requestMicrophonePermission: () => ({
      granted: true,
      state: 'granted',
      reason: 'Desktop voice capture is enabled.'
    })
  };
  const deviceProvider = {
    listInputDevices: () => [microphoneDevice],
    getDefaultInputDeviceId: () => microphoneDevice.id
  };
  const captureBackend = createDesktopMicrophoneBackend();
  const audioCapture = new AudioCapture({
    deviceManager: new AudioDeviceManager({ provider: deviceProvider, defaultDeviceId: microphoneDevice.id, logger: mainLogger }),
    permissions: new AudioPermissions({ provider: permissionProvider, logger: mainLogger }),
    backend: captureBackend,
    logger: mainLogger
  });
  const sttModelPath = resolveDesktopSttModelPath();
  voiceSttSummary = buildVoiceSttSummary(sttModelPath);
  logVoiceModelLoadingOnce('desktop-voice-resources');
  const sttEngine = new STTEngine({
    configuration: new STTConfiguration({
      modelPath: sttModelPath
    }),
    logger: mainLogger
  });

  return {
    audioCapture,
    sttEngine
  };
}

function createVoiceOverlayForManager(manager) {
  const windowController = new VoiceWindowController({
    BrowserWindow,
    screen,
    preloadPath: PRELOAD_PATH,
    logger: mainLogger
  });
  const overlay = new VoiceOverlay({
    windowController,
    theme: new VoiceTheme({ settings: settingsService?.getSnapshot?.() || {} }),
    logger: mainLogger
  });
  overlay.attachToSessionManager(manager);
  return overlay;
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

function createPeopleChatWindow() {
  const chatWasOpen = Boolean(chatWindow && !chatWindow.isDestroyed());
  createChatWindow();
  const openPeopleChat = () => {
    if (chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.webContents.send('desktopChat:open');
    }
  };
  if (chatWasOpen) {
    openPeopleChat();
  } else {
    chatWindow.webContents.once('did-finish-load', openPeopleChat);
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

async function ensureVisualMemoryRuntime() {
  if (!visualMemoryEngine) {
    const dataDir = runtimeConfig?.app?.dataPaths?.visualMemoryDir || BASE_CONFIG.app.dataPaths.visualMemoryDir;
    mainLogger.info('[Gallery] Preparing OpenX Visual Memory runtime.', { dataDir });
    visualMemoryEngine = new VisualMemoryEngine({
      dataDir,
      logging: { console: false, file: false },
      logger: mainLogger
    });
  }
  await visualMemoryEngine.api.start();
  if (!visualMemoryReadyLogged) {
    visualMemoryReadyLogged = true;
    mainLogger.info('[Gallery] Visual Memory runtime is ready for photos, people, and memory search.', {
      state: visualMemoryEngine.getStatus?.().lifecycle?.state,
      localOnly: visualMemoryEngine.getStatus?.().localOnly
    });
  }
  if (!visualMemoryDefaultFoldersReady) {
    try {
      await visualMemoryEngine.api.addDefaultFolders();
      visualMemoryDefaultFoldersReady = true;
      mainLogger.info('[Gallery] Windows Pictures folders registered for Gallery access.');
    } catch (error) {
      mainLogger.warn('[Gallery] Windows Pictures folders could not be registered for Gallery access.', { error: error.message });
    }
  }
  return visualMemoryEngine;
}

function getLazyVisualMemoryApi() {
  if (lazyVisualMemoryApi) return lazyVisualMemoryApi;
  lazyVisualMemoryApi = new Proxy({}, {
    get(_target, property) {
      if (property === 'then') return undefined;
      return async (...args) => {
        const engine = await ensureVisualMemoryRuntime();
        const member = engine.api[property];
        if (typeof member === 'function') return member.apply(engine.api, args);
        return member;
      };
    }
  });
  return lazyVisualMemoryApi;
}

async function ensureVisualMemoryGalleryIndexed() {
  if (visualMemoryIndexPromise) return visualMemoryIndexPromise;
  visualMemoryIndexPromise = (async () => {
    const engine = await ensureVisualMemoryRuntime();
    const folders = engine.api.listFolders();
    const needsIndex = folders.some(folder => folder?.enabled !== false && !folder.lastIndexedAt);
    const existingTotal = Object.keys(engine.database.getTable('photos') || {}).length;
    if (!needsIndex && existingTotal > 0) {
      mainLogger.info('[Gallery] Photo index is already fresh; using existing Gallery library.', { totalPhotos: existingTotal });
      return { skipped: true, total: existingTotal };
    }
    mainLogger.info('[Gallery] Photo indexing started in the background.', {
      folders: folders.filter(folder => folder?.enabled !== false).length,
      existingPhotos: existingTotal
    });
    return engine.api.refreshGallery({
      maxDepth: runtimeConfig?.visualMemory?.performance?.maxIndexDepth || 8,
      maxFiles: runtimeConfig?.visualMemory?.performance?.maxIndexFiles || 50000
    });
  })().finally(() => {
    visualMemoryIndexPromise = null;
  });
  return visualMemoryIndexPromise;
}

function isVisualMemoryIndexing() {
  return Boolean(visualMemoryIndexPromise);
}

function createGalleryWindow(initialView = 'timeline', options = {}) {
  const view = ['timeline', 'photos', 'favorites', 'recent', 'people'].includes(String(initialView || '').toLowerCase())
    ? String(initialView || 'timeline').toLowerCase()
    : 'timeline';
  if (galleryWindow && !galleryWindow.isDestroyed()) {
    galleryWindow.show();
    galleryWindow.focus();
    galleryWindow.webContents.send('gallery:view', view);
    if (options.lowerChat) lowerChatWindowForPlanner();
    return { success: true, view };
  }

  galleryWindow = new BrowserWindow({
    width: 1160,
    height: 760,
    minWidth: 900,
    minHeight: 620,
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

  const galleryFile = path.join(RENDERER_ROOT, 'gallery', 'index.html');
  secureWindow(galleryWindow, {
    windowType: 'gallery',
    expectedFile: galleryFile,
    createWindow: () => createGalleryWindow(view, options)
  });
  let didRevealGallery = false;
  const revealGallery = () => {
    if (didRevealGallery || !galleryWindow || galleryWindow.isDestroyed()) return;
    didRevealGallery = true;
    galleryWindow.center();
    galleryWindow.show();
    galleryWindow.focus();
    if (options.lowerChat) lowerChatWindowForPlanner();
  };
  galleryWindow.once('ready-to-show', revealGallery);
  galleryWindow.loadFile(galleryFile).then(() => {
    if (galleryWindow && !galleryWindow.isDestroyed()) {
      galleryWindow.webContents.send('gallery:view', view);
      revealGallery();
    }
  }).catch(error => {
    mainLogger.error('Failed to load gallery renderer', { error: error.message });
  });
  galleryWindow.on('closed', () => {
    galleryWindow = null;
    restoreChatWindowPriority();
  });
  return { success: true, view };
}

function sendGalleryOpenPhoto(photoId, viewer = null) {
  if (!galleryWindow || galleryWindow.isDestroyed()) return;
  const send = () => {
    if (!galleryWindow || galleryWindow.isDestroyed()) return;
    galleryWindow.webContents.send('gallery:openPhoto', { photoId, viewer });
  };
  if (galleryWindow.webContents.isLoading()) {
    galleryWindow.webContents.once('did-finish-load', () => setTimeout(send, 50));
  } else {
    send();
  }
}

function sendGalleryPeopleScanProgress(payload = {}) {
  if (!galleryWindow || galleryWindow.isDestroyed()) return;
  galleryWindow.webContents.send('gallery:peopleScanProgress', {
    stage: String(payload.stage || 'scan'),
    message: String(payload.message || ''),
    detail: String(payload.detail || ''),
    success: payload.success,
    reason: String(payload.reason || ''),
    scanned: Number(payload.scanned || 0),
    total: Number(payload.total || 0),
    percent: payload.percent === null ? null : Number(payload.percent || 0),
    indexedPhotos: Number(payload.indexedPhotos || 0),
    alreadyKnownPhotos: Number(payload.alreadyKnownPhotos || 0),
    detectedFaces: Number(payload.detectedFaces || 0),
    verifiedFaces: Number(payload.verifiedFaces || 0),
    newUnnamedPeople: Number(payload.newUnnamedPeople || 0),
    namedPeople: Number(payload.namedPeople || 0),
    readyToName: Number(payload.readyToName || 0),
    matchedKnownPeople: Number(payload.matchedKnownPeople || 0),
    duplicateFacesSkipped: Number(payload.duplicateFacesSkipped || 0),
    duplicatePeopleMerged: Number(payload.duplicatePeopleMerged || 0),
    unclearFacesRemoved: Number(payload.unclearFacesRemoved || 0),
    skipped: Number(payload.skipped || 0),
    warnings: Number(payload.warnings || 0),
    durationMs: Number(payload.durationMs || 0),
    timestamp: String(payload.timestamp || new Date().toISOString())
  });
}

function mimeTypeForImage(filePath) {
  const extension = path.extname(String(filePath || '')).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.png') return 'image/png';
  if (extension === '.gif') return 'image/gif';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.bmp') return 'image/bmp';
  return 'application/octet-stream';
}

async function getGalleryPhotoData(query = {}) {
  const engine = await ensureVisualMemoryRuntime();
  const folders = engine.api.listFolders();
  const existingTotal = Object.keys(engine.database.getTable('photos') || {}).length;
  const needsIndex = folders.some(folder => folder?.enabled !== false && !folder.lastIndexedAt) || existingTotal === 0;
  if (needsIndex && !isVisualMemoryIndexing()) {
    mainLogger.info('[Gallery] Gallery needs a photo index refresh; starting background scan.');
    ensureVisualMemoryGalleryIndexed().catch(error => {
      mainLogger.warn('[Gallery] Background Gallery photo indexing failed.', { error: error.message });
    });
  }
  const result = engine.api.getPhotos({
    page: query.page,
    pageSize: query.pageSize,
    sortBy: 'createdAt',
    sortDirection: 'desc'
  });
  const metadata = engine.database.getTable('metadata');
  const items = (result.items || []).map(photo => ({
    id: photo.id,
    fileName: photo.fileName,
    filePath: photo.filePath,
    fileType: photo.fileType,
    fileSize: photo.fileSize || 0,
    createdAt: photo.createdAt || metadata[photo.id]?.createdAt || photo.indexedAt || null,
    modifiedAt: photo.modifiedAt || null,
    width: metadata[photo.id]?.width || null,
    height: metadata[photo.id]?.height || null,
    city: metadata[photo.id]?.city || '',
    folderId: photo.folderId || '',
    thumbnailReady: Boolean(photo.thumbnail)
  }));
  return {
    success: true,
    data: {
      items,
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      hasMore: result.hasMore,
      indexing: isVisualMemoryIndexing()
    }
  };
}

function normalizeGalleryPhotoItem(photo, metadata = {}, extra = {}) {
  return {
    id: photo.id,
    fileName: photo.fileName,
    filePath: photo.filePath,
    fileType: photo.fileType,
    fileSize: photo.fileSize || 0,
    createdAt: photo.createdAt || metadata?.createdAt || photo.indexedAt || null,
    modifiedAt: photo.modifiedAt || null,
    width: metadata?.width || null,
    height: metadata?.height || null,
    city: metadata?.city || '',
    folderId: photo.folderId || '',
    thumbnailReady: Boolean(photo.thumbnail),
    ...extra
  };
}

async function getGalleryViewData(view = 'timeline', query = {}) {
  const normalizedView = String(view || 'timeline').toLowerCase();
  if (normalizedView === 'timeline' || normalizedView === 'photos') return getGalleryPhotoData(query);
  const engine = await ensureVisualMemoryRuntime();
  if (normalizedView === 'people') {
    mainLogger.info('[Gallery] Loading People view from verified face memory.');
    const people = await engine.api.getOpenXGalleryPeople();
    return { success: true, data: people };
  }

  const metadata = engine.database.getTable('metadata');
  const source = normalizedView === 'favorites'
    ? await engine.api.getOpenXGalleryFavorites('images')
    : normalizedView === 'recent'
      ? await engine.api.getOpenXGalleryRecent('images')
      : { items: [] };
  const items = (source.items || [])
    .map(entry => {
      const photoId = entry.photoId || entry.id;
      const photo = engine.api.getPhoto(photoId);
      if (!photo?.id) return null;
      return normalizeGalleryPhotoItem(photo, metadata[photo.id] || photo.metadata || {}, {
        favorite: normalizedView === 'favorites' || entry.favorite === true,
        favoritedAt: entry.favoritedAt || null,
        viewedAt: entry.viewedAt || null
      });
    })
    .filter(Boolean);
  return {
    success: true,
    data: {
      view: normalizedView,
      items,
      page: 1,
      pageSize: items.length,
      total: items.length,
      hasMore: false,
      indexing: isVisualMemoryIndexing()
    }
  };
}

async function getGalleryImageData(photoId) {
  const engine = await ensureVisualMemoryRuntime();
  const photo = engine.api.getPhoto(photoId);
  if (!photo?.filePath) return { success: false, error: 'Photo not found' };
  const resolved = path.resolve(photo.filePath);
  if (!fs.existsSync(resolved)) return { success: false, error: 'Image file is missing' };
  const favorites = await engine.api.getOpenXGalleryFavorites('images');
  const favorite = Array.isArray(favorites?.items) && favorites.items.some(item => item.id === photo.id);
  return {
    success: true,
    data: {
      photoId: photo.id,
      mimeType: mimeTypeForImage(resolved),
      favorite,
      src: pathToFileURL(resolved).href
    }
  };
}

async function openGalleryPhotoViewer(photoId) {
  const engine = await ensureVisualMemoryRuntime();
  const viewer = await engine.api.openOpenXGalleryViewer(photoId);
  const favorites = await engine.api.getOpenXGalleryFavorites('images');
  const favorite = Array.isArray(favorites?.items) && favorites.items.some(item => item.id === photoId);
  return { ...viewer, favorite };
}

async function showGalleryPhoto(photoId) {
  const viewer = await openGalleryPhotoViewer(photoId);
  createGalleryWindow('timeline', { lowerChat: true });
  sendGalleryOpenPhoto(photoId, viewer);
  return { success: true, data: viewer };
}

async function toggleGalleryPhotoFavorite(photoId, value = null) {
  const engine = await ensureVisualMemoryRuntime();
  const favorite = await engine.api.toggleOpenXGalleryFavorite('images', photoId, value);
  mainLogger.info(favorite?.favorite === false
    ? '[Gallery] Photo removed from Favorites.'
    : '[Gallery] Photo added to Favorites.', { photoId });
  return { success: true, data: favorite };
}

async function nameGalleryFace(clusterId, name, relationship = '') {
  const engine = await ensureVisualMemoryRuntime();
  mainLogger.info('[Gallery] Saving a name for a detected person.', {
    clusterId,
    hasName: Boolean(String(name || '').trim()),
    relationship: relationship || ''
  });
  const status = await engine.api.getFaceMemoryStatus();
  if (!status?.consent?.enabled && status?.enabled !== true) {
    await engine.api.enableFaceMemory({ acceptedBy: 'gallery-person-naming' });
  }
  const result = await engine.api.enrollFaceCluster({ clusterId, name, relationship });
  mainLogger.info('[Gallery] Person name saved in Face Memory.', {
    clusterId,
    identityId: result?.identity?.id || result?.identityId || null,
    name: result?.identity?.name || name
  });
  return { success: true, data: result };
}

async function setGalleryFaceRelationship(identityId, relationship = '') {
  const engine = await ensureVisualMemoryRuntime();
  mainLogger.info('[Gallery] Updating a saved person relationship.', {
    identityId,
    relationship: relationship || ''
  });
  const result = await engine.api.setFaceRelationship(identityId, relationship, 'gallery-people-relation');
  mainLogger.info('[Gallery] Saved person relationship updated.', {
    identityId,
    relationship: result?.relationship || relationship || ''
  });
  return { success: true, data: result };
}

async function updateGalleryFacePerson(identityId, name, relationship = '') {
  const engine = await ensureVisualMemoryRuntime();
  mainLogger.info('[Gallery] Updating a saved person.', {
    identityId,
    hasName: Boolean(String(name || '').trim()),
    relationship: relationship || ''
  });
  const result = await engine.api.updateFaceIdentity(identityId, { name, relationship }, 'gallery-people-edit');
  mainLogger.info('[Gallery] Saved person updated.', {
    identityId,
    name: result?.identity?.name || name,
    relationship: result?.identity?.relationship || relationship || ''
  });
  return { success: true, data: result };
}

async function deleteGalleryFacePerson(identityId) {
  const engine = await ensureVisualMemoryRuntime();
  mainLogger.info('[Gallery] Deleting a saved person from Face Memory.', { identityId });
  const deleted = await engine.api.deleteFaceIdentity(identityId);
  mainLogger.info(deleted
    ? '[Gallery] Saved person deleted from Face Memory.'
    : '[Gallery] Saved person was already removed.', { identityId });
  return { success: Boolean(deleted), data: { identityId, deleted: Boolean(deleted) } };
}

async function addGalleryFaceToPerson(clusterId, identityId) {
  const engine = await ensureVisualMemoryRuntime();
  mainLogger.info('[Gallery] Adding an unnamed detected face to an existing person.', { clusterId, identityId });
  const result = await engine.api.addFaceClusterToIdentity({ clusterId, identityId });
  mainLogger.info('[Gallery] Detected face added to existing person.', {
    clusterId,
    identityId,
    name: result?.identity?.name || result?.profile?.name || ''
  });
  return { success: true, data: result };
}

async function removeGalleryFaceCluster(clusterId) {
  const engine = await ensureVisualMemoryRuntime();
  mainLogger.info('[Gallery] Removing an unwanted unnamed face from People.', { clusterId });
  const removed = await engine.api.deleteFaceCluster(clusterId);
  mainLogger.info(removed
    ? '[Gallery] Unwanted face removed from People.'
    : '[Gallery] Unwanted face was already removed.', { clusterId });
  return { success: Boolean(removed), data: { clusterId, removed: Boolean(removed) } };
}

async function scanGalleryPeople(options = {}) {
  const engine = await ensureVisualMemoryRuntime();
  mainLogger.info('[Gallery] People scan requested from the Gallery UI.', {
    maxPhotos: options.maxPhotos || null,
    scanMode: options.rescan === true ? 'full-rescan' : options.incremental === false ? 'all-without-reset' : 'incremental'
  });
  const result = await engine.api.scanGalleryPeople({
    maxPhotos: options.maxPhotos,
    rescan: options.rescan === true,
    incremental: options.incremental === false ? false : true,
    acceptedBy: 'gallery-people-scan',
    onProgress: sendGalleryPeopleScanProgress
  });
  if (result.success === false) {
    mainLogger.warn('[Gallery] People scan could not run.', {
      reason: result.reason,
      warnings: result.warnings?.length || 0
    });
  } else {
    mainLogger.info('[Gallery] People scan completed and the People view is updated.', {
      scanned: result.scanned,
      detectedFaces: result.detectedFaces,
      verifiedFaces: result.verifiedFaces,
      grouped: result.grouped,
      skippedAlreadyScannedPhotos: result.skippedAlreadyScannedPhotos,
      skipped: result.skipped,
      warnings: result.warnings?.length || 0
    });
  }
  return { success: result.success !== false, data: result };
}

function formatScheduleDueLabel(schedule = {}) {
  const due = new Date(schedule.dueAt || Date.now());
  if (Number.isNaN(due.getTime())) return 'Due now';
  return due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatScheduleRecurrenceLabel(recurrence = '') {
  const key = String(recurrence || '').trim().toLowerCase();
  if (!key) return '';
  if (key.startsWith('weekly:')) {
    const days = key
      .slice('weekly:'.length)
      .split(',')
      .map(day => day.trim())
      .filter(Boolean)
      .map(day => day.charAt(0).toUpperCase() + day.slice(1));
    if (days.length === 1) return `Every ${days[0]}`;
    if (days.length > 1) return `Every ${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`;
  }
  return `Repeats ${key.replace(/-/g, ' ')}`;
}

function scheduleActionId(schedule = {}) {
  return String(schedule.id || schedule.taskName || '').trim();
}

function buildScheduleDynamicIslandActions(schedule = {}) {
  const scheduleId = scheduleActionId(schedule);
  if (!scheduleId) return [];
  return [
    {
      id: 'snooze',
      label: 'Snooze 5 min',
      kind: 'snooze',
      scheduleId,
      minutes: 5
    },
    {
      id: 'stop',
      label: 'Stop',
      kind: 'stop',
      scheduleId,
      primary: true
    }
  ];
}

function clearLiveScheduleCollapseTimer() {
  if (liveScheduleCollapseTimer) {
    clearTimeout(liveScheduleCollapseTimer);
    liveScheduleCollapseTimer = null;
  }
}

function liveScheduleCompactStatus(schedule = {}) {
  const kind = String(schedule.kind || 'Schedule').trim() || 'Schedule';
  if (String(kind).toLowerCase() === 'alarm') return `Alarm ${formatScheduleDueLabel(schedule)}`;
  return `${kind} running`;
}

function liveScheduleIcon(schedule = {}) {
  return String(schedule.kind || '').toLowerCase() === 'alarm' ? '\u23F0' : '\u23F1';
}

function buildLiveSchedulePayload(schedule = {}) {
  const kind = String(schedule.kind || 'Schedule').trim() || 'Schedule';
  const message = String(schedule.message || schedule.title || `${kind} is running`).trim();
  return {
    success: true,
    intent: 'schedule.live',
    response: message,
    data: {
      schedule: {
        ...schedule,
        dueLabel: formatScheduleDueLabel(schedule),
        recurrenceLabel: formatScheduleRecurrenceLabel(schedule.recurrence)
      },
      actions: [],
      resultEntries: []
    },
    ui: {
      icon: liveScheduleIcon(schedule),
      previewStatus: liveScheduleCompactStatus(schedule),
      preExpandDelayMs: 80,
      autoHideMs: 0,
      persistUntilAction: true
    }
  };
}

function collapseLiveScheduleToCompact(schedule = activeLiveSchedulePayload?.data?.schedule || {}) {
  clearLiveScheduleCollapseTimer();
  if (!voiceOverlay?.windowController || typeof voiceOverlay.windowController.collapseAssistantResult !== 'function') return false;
  const kind = String(schedule.kind || 'Schedule').toLowerCase();
  voiceOverlay.windowController.collapseAssistantResult({
    statusText: liveScheduleCompactStatus(schedule),
    icon: liveScheduleIcon({ kind }),
    presentationClass: 'schedule-live-compact'
  });
  return true;
}

function presentLiveScheduleInDynamicIsland(schedule = {}, options = {}) {
  if (!voiceOverlay || typeof voiceOverlay.displayAssistantResult !== 'function') return false;
  const kind = String(schedule.kind || '').toLowerCase();
  if (!['timer', 'alarm'].includes(kind)) return false;
  if (kind === 'timer') hideTimerWidget();
  const dueAt = new Date(schedule.dueAt || 0).getTime();
  if (!Number.isFinite(dueAt) || dueAt <= Date.now()) return false;
  activeLiveSchedulePayload = buildLiveSchedulePayload(schedule);
  clearLiveScheduleCollapseTimer();
  try {
    voiceOverlay.displayAssistantResult(activeLiveSchedulePayload);
    const expandMs = Math.max(0, Math.min(30000, Number(options.expandMs ?? LIVE_SCHEDULE_INITIAL_EXPAND_MS)));
    if (expandMs > 0) {
      liveScheduleCollapseTimer = setTimeout(() => collapseLiveScheduleToCompact(schedule), expandMs);
      if (typeof liveScheduleCollapseTimer.unref === 'function') liveScheduleCollapseTimer.unref();
    }
    return true;
  } catch (error) {
    mainLogger.warn('Dynamic Island live schedule popup failed', { error: error.message });
    return false;
  }
}

function expandLiveScheduleInDynamicIsland() {
  if (!activeLiveSchedulePayload) return { success: false, error: 'No active live schedule' };
  const schedule = activeLiveSchedulePayload.data?.schedule || {};
  const dueAt = new Date(schedule.dueAt || 0).getTime();
  if (!Number.isFinite(dueAt) || dueAt <= Date.now()) {
    activeLiveSchedulePayload = null;
    clearLiveScheduleCollapseTimer();
    return { success: false, error: 'Live schedule is no longer active' };
  }
  clearLiveScheduleCollapseTimer();
  voiceOverlay?.displayAssistantResult?.(activeLiveSchedulePayload);
  liveScheduleCollapseTimer = setTimeout(() => collapseLiveScheduleToCompact(schedule), LIVE_SCHEDULE_INITIAL_EXPAND_MS);
  if (typeof liveScheduleCollapseTimer.unref === 'function') liveScheduleCollapseTimer.unref();
  return { success: true };
}

function clearLiveScheduleActivity(schedule = null) {
  clearLiveScheduleCollapseTimer();
  if (!schedule || !activeLiveSchedulePayload) {
    activeLiveSchedulePayload = null;
    return;
  }
  const active = activeLiveSchedulePayload.data?.schedule || {};
  const activeId = String(active.id || active.taskName || '');
  const scheduleId = String(schedule.id || schedule.taskName || '');
  if (!scheduleId || activeId === scheduleId) activeLiveSchedulePayload = null;
}

function latestActiveLiveSchedule() {
  const items = Array.isArray(assistant?.automation?.scheduler?.scheduledItems)
    ? assistant.automation.scheduler.scheduledItems
    : [];
  return items
    .filter(item => ['timer', 'alarm'].includes(String(item.kind || '').toLowerCase()) && ['scheduled', 'paused'].includes(item.status))
    .filter(item => {
      const dueAt = new Date(item.dueAt || 0).getTime();
      return Number.isFinite(dueAt) && (item.status === 'paused' || dueAt > Date.now());
    })
    .sort((left, right) => new Date(left.dueAt || 0).getTime() - new Date(right.dueAt || 0).getTime())[0] || null;
}

function restoreLiveScheduleInDynamicIsland() {
  const schedule = latestActiveLiveSchedule();
  if (!schedule) return false;
  return presentLiveScheduleInDynamicIsland(schedule, { expandMs: 0 }) && collapseLiveScheduleToCompact(schedule);
}

function presentScheduleInDynamicIsland(schedule = {}) {
  if (!voiceOverlay || typeof voiceOverlay.displayAssistantResult !== 'function') return false;
  clearLiveScheduleActivity(schedule);
  const kind = String(schedule.kind || 'Schedule').trim() || 'Schedule';
  if (kind.toLowerCase() === 'timer') hideTimerWidget();
  const message = String(schedule.message || schedule.title || `${kind} is due`).trim();
  const dueLabel = formatScheduleDueLabel(schedule);
  const recurrenceLabel = formatScheduleRecurrenceLabel(schedule.recurrence);
  try {
    voiceOverlay.displayAssistantResult({
      success: true,
      intent: 'schedule.due',
      response: message,
      data: {
        schedule: {
          ...schedule,
          dueLabel,
          recurrenceLabel
        },
        actions: buildScheduleDynamicIslandActions(schedule),
        resultEntries: []
      },
      ui: {
        icon: kind.slice(0, 2).toUpperCase(),
        previewStatus: `${kind} due`,
        preExpandDelayMs: 1000,
        autoHideMs: 0,
        persistUntilAction: true
      }
    });
    return true;
  } catch (error) {
    mainLogger.warn('Dynamic Island schedule popup failed', { error: error.message });
    return false;
  }
}

function normalizePhoneNotification(notification = {}, metadata = {}) {
  const details = notification.details && typeof notification.details === 'object' ? notification.details : {};
  const sourceName = String(
    notification.sourceDeviceName ||
    notification.deviceName ||
    metadata.deviceName ||
    details.deviceName ||
    'Mobile'
  ).replace(/\s+/g, ' ').trim().slice(0, 80);
  const appName = String(
    notification.appName ||
    notification.packageName ||
    details.appName ||
    notification.category ||
    'Notification'
  ).replace(/\s+/g, ' ').trim().slice(0, 80);
  const title = String(notification.title || appName || 'Notification').replace(/\s+/g, ' ').trim().slice(0, 140);
  const message = String(notification.message || notification.text || notification.body || '').replace(/\s+/g, ' ').trim().slice(0, 360);
  const packageName = String(notification.packageName || details.packageName || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const repeatCount = Math.max(1, Math.round(Number(notification.repeatCount || details.repeatCount) || 1));
  const notificationKey = String(details.notificationKey || notification.notificationKey || '').replace(/\s+/g, ' ').trim().slice(0, 220);
  return {
    notificationId: String(notification.notificationId || notification.id || notificationKey || `phone_notification_${Date.now()}`).trim(),
    sourceName,
    appName,
    packageName,
    title,
    message,
    receivedAt: notification.createdAt || notification.timestamp || Date.now(),
    priority: String(notification.priority || 'normal').toLowerCase(),
    repeatCount,
    notificationKey,
    groupKey: String(details.groupKey || packageName || appName || sourceName).toLowerCase()
  };
}

const PHONE_NOTIFICATION_BURST_WINDOW_MS = 650;
const PHONE_NOTIFICATION_MAX_GROUP_ITEMS = 6;
const PHONE_NOTIFICATION_MAX_GROUPS = 16;
const phoneNotificationGroups = new Map();

function phoneNotificationInitials(appName) {
  const words = String(appName || 'Phone').replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? `${words[0][0]}${words[1][0]}` : String(words[0] || 'PH').slice(0, 2)).toUpperCase();
}

function phoneNotificationGroupKey(notification) {
  return [
    notification.sourceName,
    notification.groupKey || notification.packageName || notification.appName
  ].map(value => String(value || '').toLowerCase()).join('|');
}

function displayPhoneNotificationGroup(groupKey) {
  const group = phoneNotificationGroups.get(groupKey);
  if (!group) return false;
  phoneNotificationGroups.delete(groupKey);
  if (group.timer) clearTimeout(group.timer);
  if (!voiceOverlay || typeof voiceOverlay.displayAssistantResult !== 'function') return false;

  const notifications = [...group.notifications.values()]
    .sort((left, right) => Number(right.receivedAt || 0) - Number(left.receivedAt || 0));
  if (!notifications.length) return false;
  const primary = notifications[0];
  const totalCount = notifications.reduce((count, item) => count + Math.max(1, Number(item.repeatCount) || 1), 0);
  const grouped = totalCount > 1 || notifications.length > 1;
  const response = grouped
    ? `${totalCount} ${primary.appName} notifications from ${primary.sourceName}`
    : (primary.message || primary.title);
  try {
    voiceOverlay.displayAssistantResult({
      success: true,
      intent: 'phone.notification',
      response,
      data: {
        notification: primary,
        notificationCount: totalCount,
        grouped,
        actions: [{
          id: 'ok',
          label: 'OK',
          kind: 'dismiss',
          primary: true
        }],
        resultEntries: notifications.slice(0, PHONE_NOTIFICATION_MAX_GROUP_ITEMS).map((item, index) => ({
          index: index + 1,
          name: item.title,
          type: item.appName,
          location: item.repeatCount > 1 ? `${item.sourceName} (${item.repeatCount})` : item.sourceName,
          snippet: item.message || 'Received from OpenX Mobile.'
        }))
      },
      ui: {
        icon: phoneNotificationInitials(primary.appName),
        previewStatus: grouped
          ? `${primary.appName} - ${totalCount} notifications`
          : `${primary.appName} from ${primary.sourceName}`,
        preExpandDelayMs: grouped ? 350 : 650,
        autoHideMs: 15000,
        persistUntilAction: false
      }
    });
    return true;
  } catch (error) {
    mainLogger.warn('Dynamic Island phone notification failed', { error: error.message });
    return false;
  }
}

function trimPhoneNotificationGroup(group) {
  const overflow = group.notifications.size - PHONE_NOTIFICATION_MAX_GROUP_ITEMS;
  if (overflow <= 0) return;
  const oldest = [...group.notifications.entries()]
    .sort((left, right) => Number(left[1].receivedAt || 0) - Number(right[1].receivedAt || 0))
    .slice(0, overflow);
  for (const [notificationId] of oldest) group.notifications.delete(notificationId);
}

function enforcePhoneNotificationGroupLimit() {
  while (phoneNotificationGroups.size > PHONE_NOTIFICATION_MAX_GROUPS) {
    const oldest = [...phoneNotificationGroups.entries()]
      .sort((left, right) => Number(left[1].lastUpdatedAt || 0) - Number(right[1].lastUpdatedAt || 0))[0];
    if (!oldest) return;
    displayPhoneNotificationGroup(oldest[0]);
  }
}

function presentPhoneNotificationInDynamicIsland(notification = {}, metadata = {}) {
  const normalized = normalizePhoneNotification(notification, metadata);
  const key = phoneNotificationGroupKey(normalized);
  const group = phoneNotificationGroups.get(key) || { notifications: new Map(), timer: null, lastUpdatedAt: 0 };
  const existing = group.notifications.get(normalized.notificationId);
  group.notifications.set(normalized.notificationId, existing
    ? {
        ...existing,
        ...normalized,
        repeatCount: Math.max(
          Math.max(1, Number(existing.repeatCount) || 1),
          Math.max(1, Number(normalized.repeatCount) || 1)
        ),
        receivedAt: Math.max(Number(existing.receivedAt) || 0, Number(normalized.receivedAt) || 0) || Date.now()
      }
    : normalized);
  trimPhoneNotificationGroup(group);
  if (group.timer) clearTimeout(group.timer);
  group.timer = setTimeout(() => displayPhoneNotificationGroup(key), PHONE_NOTIFICATION_BURST_WINDOW_MS);
  group.timer.unref?.();
  group.lastUpdatedAt = Date.now();
  phoneNotificationGroups.set(key, group);
  enforcePhoneNotificationGroupLimit();
  if (normalized.priority === 'critical') {
    clearTimeout(group.timer);
    group.timer = null;
    return displayPhoneNotificationGroup(key);
  }
  return true;
}

function formatTransferSize(bytes) {
  const size = Math.max(0, Number(bytes) || 0);
  if (size < 1024) return `${size} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = size / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${unit}`;
}

function cloudTransferDisplayName(transfer = {}) {
  return String(transfer.fileName || 'file').replace(/\s+/g, ' ').trim().slice(0, 160) || 'file';
}

function getCloudReceivedDirectory() {
  return runtimeConfig?.app?.dataPaths?.cloudReceivedDir ||
    BASE_CONFIG.app?.dataPaths?.cloudReceivedDir ||
    path.join(app.getPath('documents'), 'OpenX');
}

function presentCloudFileTransferPrompt(transfer = {}) {
  if (!voiceOverlay || typeof voiceOverlay.displayAssistantResult !== 'function') return false;
  const transferId = String(transfer.transferId || '').trim();
  if (!transferId) return false;
  const fileName = cloudTransferDisplayName(transfer);
  const fileSize = formatTransferSize(transfer.fileSize);
  const sourceLabel = String(transfer.sourceDeviceName || transfer.sourceDeviceId || 'OpenX Mobile')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100) || 'OpenX Mobile';
  try {
    voiceOverlay.displayAssistantResult({
      success: true,
      intent: 'cloud.fileTransfer.incoming',
      response: `${sourceLabel} wants to send ${fileName}.`,
      data: {
        transfer: {
          transferId,
          fileName,
          fileSize: Math.max(0, Number(transfer.fileSize) || 0),
          fileSizeLabel: fileSize,
          sourceDeviceId: String(transfer.sourceDeviceId || '').slice(0, 128),
          destination: getCloudReceivedDirectory()
        },
        actions: [
          {
            id: 'reject',
            label: 'Reject',
            kind: 'reject',
            transferId
          },
          {
            id: 'accept',
            label: 'Accept',
            kind: 'accept',
            transferId,
            primary: true
          }
        ],
        resultEntries: [
          {
            index: 1,
            name: fileName,
            type: 'incoming file',
            location: fileSize,
            snippet: `Save to Documents\\OpenX`
          }
        ]
      },
      ui: {
        icon: 'FI',
        previewStatus: `Incoming file - ${fileSize}`,
        preExpandDelayMs: 100,
        autoHideMs: 0,
        persistUntilAction: true
      }
    });
    return true;
  } catch (error) {
    mainLogger.warn('[CLOUD-FILE] Dynamic Island transfer prompt failed', {
      transferId,
      error: error.message
    });
    return false;
  }
}

function presentCloudFileTransferStatus(transfer = {}, status = 'progress') {
  if (!voiceOverlay || typeof voiceOverlay.displayAssistantResult !== 'function') return false;
  const fileName = cloudTransferDisplayName(transfer);
  const percent = Math.max(0, Math.min(100, Math.round(Number(transfer.percent) || 0)));
  const filePath = String(transfer.filePath || transfer.destination || '').trim();
  const direction = String(transfer.direction || '').toLowerCase();
  const outgoingToMobile = direction === 'desktop-to-phone';
  const completed = status === 'completed';
  const failed = status === 'failed';
  const response = completed
    ? outgoingToMobile
      ? `${fileName} was sent to mobile.`
      : `${fileName} was saved to Documents\\OpenX.`
    : failed
      ? `${fileName} transfer failed.`
      : outgoingToMobile
        ? `Sending ${fileName}: ${percent}%.`
        : `Receiving ${fileName}: ${percent}%.`;
  try {
    voiceOverlay.displayAssistantResult({
      success: !failed,
      intent: `cloud.fileTransfer.${status}`,
      response,
      data: {
        resultEntries: [
          {
            index: 1,
            name: fileName,
            type: completed ? outgoingToMobile ? 'sent file' : 'saved file' : 'file transfer',
            location: completed ? outgoingToMobile ? 'OpenX Mobile' : 'Documents\\OpenX' : `${percent}%`,
            snippet: filePath || response
          }
        ],
        actions: []
      },
      ui: {
        icon: failed ? '!' : 'FI',
        previewStatus: completed
          ? outgoingToMobile ? 'File sent to mobile' : 'File received'
          : failed
            ? 'Transfer failed'
            : outgoingToMobile ? `Sending ${percent}%` : `Receiving ${percent}%`,
        preExpandDelayMs: completed || failed ? 600 : 0,
        autoHideMs: completed ? outgoingToMobile ? 5000 : 8000 : failed ? 8000 : 0,
        persistUntilAction: false
      }
    });
    return true;
  } catch (error) {
    mainLogger.warn('[CLOUD-FILE] Dynamic Island transfer status failed', {
      transferId: transfer.transferId || null,
      status,
      error: error.message
    });
    return false;
  }
}

function shouldPresentCloudFileTransferProgress(transfer = {}) {
  const transferId = String(transfer.transferId || '').trim();
  if (!transferId) return false;
  const percent = Math.max(0, Math.min(100, Math.round(Number(transfer.percent) || 0)));
  const last = cloudFileTransferUiProgress.get(transferId) || { percent: -1, at: 0 };
  const now = Date.now();
  if (percent < 100 && percent < last.percent + 10 && now - last.at < 1500) return false;
  cloudFileTransferUiProgress.set(transferId, { percent, at: now });
  return true;
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

function handleLiveScheduleCommand(payload) {
  if (!payload?.success || !payload.intent) return;
  const intent = String(payload.intent);
  if (/^(?:timer|alarm)\.(?:cancel|clear)$/.test(intent)) {
    clearLiveScheduleActivity(payload.data || null);
    return;
  }
  if (/^(?:timer|alarm)\.(?:set|reset|snooze)$/.test(intent)) {
    presentLiveScheduleInDynamicIsland(payload.data || {}, { expandMs: LIVE_SCHEDULE_INITIAL_EXPAND_MS });
    return;
  }
  if (/^timer\.(?:pause|resume)$/.test(intent)) {
    presentLiveScheduleInDynamicIsland(payload.data || latestActiveLiveSchedule() || {}, { expandMs: 0 });
    collapseLiveScheduleToCompact(payload.data || latestActiveLiveSchedule() || {});
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
  cloudConnectionManager.on('notification', notification => {
    if (String(notification?.category || '').toLowerCase() !== 'phone' && !notification?.details?.appName) return;
    presentPhoneNotificationInDynamicIsland(notification, { source: 'phone-cloud' });
  });
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
    const presented = presentCloudFileTransferPrompt(transfer);
    if (!presented) {
      mainLogger.warn('[CLOUD-FILE] Transfer is waiting for approval but Dynamic Island is unavailable', {
        transferId: transfer.transferId
      });
    }
  });
  cloudFileTransferManager.on('progress', transfer => {
    mainLogger.info('[CLOUD-FILE] Transfer progress', {
      transferId: transfer.transferId,
      state: transfer.state,
      percent: transfer.percent
    });
    if (
      String(transfer.direction || '').toLowerCase() === 'phone-to-desktop' &&
      ['accepted', 'downloading', 'receiving'].includes(String(transfer.state || '').toLowerCase()) &&
      shouldPresentCloudFileTransferProgress(transfer)
    ) {
      presentCloudFileTransferStatus(transfer, 'progress');
    }
    const busyStates = new Set(['pending', 'accepted', 'transferring', 'receiving', 'downloading', 'uploading', 'waiting-approval']);
    if (busyStates.has(String(transfer.state || '').toLowerCase())) {
      manager.updatePresence?.('busy', { reason: 'file-transfer' });
    } else {
      manager.updatePresence?.('online', { reason: 'file-transfer-complete' });
    }
  });
  cloudFileTransferManager.on('completed', transfer => {
    cloudFileTransferUiProgress.delete(String(transfer.transferId || ''));
    mainLogger.info('[CLOUD-FILE] Transfer completed', {
      transferId: transfer.transferId,
      fileName: transfer.fileName,
      filePath: transfer.filePath || null
    });
    presentCloudFileTransferStatus(transfer, 'completed');
    manager.updatePresence?.('online', { reason: 'file-transfer-complete' });
  });
  cloudFileTransferManager.on('failed', transfer => {
    cloudFileTransferUiProgress.delete(String(transfer.transferId || ''));
    mainLogger.warn('[CLOUD-FILE] Transfer failed', {
      transferId: transfer.transferId,
      fileName: transfer.fileName || null,
      reason: transfer.reason || transfer.error || 'unknown'
    });
    presentCloudFileTransferStatus(transfer, 'failed');
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
      if (!isTrustedVoiceOverlayIpcSender(event, channel)) {
        assertTrustedIpcSender(event, RENDERER_ROOT);
      }
      const validatedPayload = validator(payload);
      return await handler(event, validatedPayload);
    } catch (error) {
      mainLogger.warn('IPC request rejected', {
        channel,
        sender: getIpcSenderUrl(event),
        senderWebContentsId: event?.sender?.id || null,
        senderWindowId: event?.sender ? BrowserWindow.fromWebContents(event.sender)?.id || null : null,
        voiceOverlayWebContentsId: voiceOverlay?.windowController?.window?.webContents?.id || null,
        trustedVoiceOverlaySender: isTrustedVoiceOverlayIpcSender(event, channel),
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
  delete publicConfig.visualMemoryApi;
  return toIpcSafeValue(publicConfig);
}

function sanitizeVoiceCaptureReport(payload = {}) {
  if (!isPlainObject(payload)) return { event: 'unknown', data: {} };
  const event = String(payload.event || 'unknown').replace(/[^a-z0-9:_-]/gi, '').slice(0, 80) || 'unknown';
  const data = isPlainObject(payload.data) ? payload.data : {};
  return { event, data };
}

function setupVoiceCaptureIPC() {
  if (voiceCaptureIpcRegistered) return;
  ipcMain.on('voiceCapture:frame', (event, payload) => {
    const sender = getIpcSenderUrl(event);
    if (!isVoiceCaptureRendererUrl(sender)) {
      mainLogger.warn('Rejected voice capture frame from untrusted sender', { sender });
      return;
    }
    receiveVoiceCaptureFrame(payload);
  });
  ipcMain.handle('voiceCapture:report', async (event, payload) => {
    const sender = getIpcSenderUrl(event);
    if (!isVoiceCaptureRendererUrl(sender)) {
      mainLogger.warn('Rejected voice capture report from untrusted sender', { sender });
      throw new Error('Invalid or unauthorized IPC request');
    }
    const report = sanitizeVoiceCaptureReport(payload);
    const reportRunId = Number(report.data?.runId) || 0;
    if (report.event === 'frames' && (!voiceCaptureShouldRun || (reportRunId && reportRunId !== voiceCaptureRunId))) {
      return { ok: true, ignored: true };
    }
    if (report.event === 'error') {
      mainLogger.warn('Voice microphone capture failed', report.data);
    } else {
      mainLogger.info(`Voice microphone capture ${report.event}`, report.data);
    }
    return { ok: true };
  });
  voiceCaptureIpcRegistered = true;
}

function teardownVoiceCaptureIPC() {
  if (!voiceCaptureIpcRegistered) return;
  ipcMain.removeAllListeners('voiceCapture:frame');
  ipcMain.removeHandler('voiceCapture:report');
  voiceCaptureIpcRegistered = false;
}

function setupIPC() {
  if (ipcRegistered) {
    return;
  }
  setupVoiceCaptureIPC();

  registerIpcHandler('command:process', async (_event, { input, source }) => {
    if (!assistant) return { success: false, response: 'Assistant not initialized' };
    const result = await assistant.processCommand(input, source);
    if (
      result?.needsClarification &&
      result.data?.clarificationType === 'browser.open.blankTabAlreadyOpen' &&
      chatWindow &&
      !chatWindow.isDestroyed()
    ) {
      revealChatWindow();
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

  registerIpcHandler('tts:speak', async (_event, { text }) => {
    if (textToSpeech) {
      textToSpeech.speak(text);
    }
    return { success: true };
  });

  registerIpcHandler('tts:stop', async () => {
    if (textToSpeech) {
      textToSpeech.stop();
    }
    return { success: true };
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

  registerIpcHandler('window:openPeopleChat', async () => {
    return createPeopleChatWindow();
  });

  registerIpcHandler('voice:start', async () => startVoiceListeningFromShortcut('chat-voice-button'));

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

  registerIpcHandler('window:openGallery', async (_event, { view }) => {
    return createGalleryWindow(view, { lowerChat: true });
  });

  registerIpcHandler('window:closeGallery', async () => {
    if (galleryWindow && !galleryWindow.isDestroyed()) galleryWindow.close();
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

  registerIpcHandler('desktopChat:list', async (_event, payload) => {
    return listDesktopChatConversations(payload || {});
  });

  registerIpcHandler('desktopChat:open', async (_event, payload) => {
    return openDesktopChatConversation(payload || {});
  });

  registerIpcHandler('desktopChat:create', async (_event, payload) => {
    const result = await createDesktopChatConversation(payload || {});
    notifyDesktopChatChanged({ reason: 'created', conversation: result.conversation });
    return result;
  });

  registerIpcHandler('desktopChat:update', async (_event, payload) => {
    const result = await updateDesktopChatConversation(payload || {});
    notifyDesktopChatChanged({ reason: 'updated', conversation: result.conversation });
    return result;
  });

  registerIpcHandler('desktopChat:delete', async (_event, payload) => {
    const result = await deleteDesktopChatConversation(payload || {});
    notifyDesktopChatChanged({ reason: 'deleted', conversationId: result.conversationId });
    return result;
  });

  registerIpcHandler('desktopChat:send', async (_event, payload) => {
    const result = await sendDesktopChatMessage(payload || {});
    notifyDesktopChatChanged({ reason: 'message', conversation: result.conversation });
    return result;
  });

  registerIpcHandler('desktopChat:quickReply', async (_event, payload) => {
    return quickReplyDesktopChatMessage(payload || {});
  });

  registerIpcHandler('desktopChat:contacts:list', async () => {
    return listDesktopChatContacts();
  });

  registerIpcHandler('desktopChat:contacts:accept', async (_event, payload) => {
    const result = await acceptDesktopChatContactRequest(payload || {});
    notifyDesktopChatChanged({ reason: 'trusted', conversation: result.conversation });
    return result;
  });

  registerIpcHandler('desktopChat:contacts:delete', async (_event, payload) => {
    return deleteDesktopChatContactRequest(payload || {});
  });

  registerIpcHandler('desktopChat:contacts:cancel', async (_event, payload) => {
    return cancelDesktopChatContactRequest(payload || {});
  });

  registerIpcHandler('desktopChat:registration:get', async () => {
    return getDesktopChatRegistrationStatus();
  });

  registerIpcHandler('desktopChat:registration:start', async (_event, payload) => {
    return startDesktopChatRegistration(payload || {});
  });

  registerIpcHandler('desktopChat:profile:password', async (_event, payload) => {
    return updateDesktopChatProfilePassword(payload || {});
  });

  registerIpcHandler('desktopChat:uiState', async (_event, payload) => {
    return recordDesktopChatUiState(payload || {});
  });

  registerIpcHandler('remote:listTargets', async () => {
    return getRemoteControlTargets();
  });

  registerIpcHandler('remote:control', async (_event, payload) => {
    return sendRemoteControlAction(payload || {});
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
    if (result?.success && String(result.data?.kind || '').toLowerCase() === 'timer') {
      if (action === 'snooze') presentLiveScheduleInDynamicIsland(result.data, { expandMs: 0 });
      if (action === 'stop' || action === 'remove') clearLiveScheduleActivity(result.data);
    }
    return result || { success: false, error: 'Scheduler unavailable' };
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
      if (accepted) {
        presentCloudFileTransferStatus({ ...transfer, percent: transfer.percent || 0 }, 'progress');
      }
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
    cloudFileTransferUiProgress.delete(String(transferId || ''));
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

  registerIpcHandler('voiceOverlay:collapse', async (_event, options = {}) => {
    try {
      if (typeof voiceOverlay?.windowController?.collapseAssistantResult === 'function') {
        return voiceOverlay.windowController.collapseAssistantResult(options);
      }
      voiceOverlay?.windowController?.updateAssistantResult?.({});
      return { success: true };
    } catch (error) {
      mainLogger.warn('Dynamic Island collapse request failed', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  registerIpcHandler('voiceOverlay:expandLiveSchedule', async () => expandLiveScheduleInDynamicIsland());

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

  registerIpcHandler('gallery:getView', async (_event, payload) => {
    return getGalleryViewData(payload.view, payload);
  });

  registerIpcHandler('gallery:getPhotos', async (_event, payload) => {
    return getGalleryPhotoData(payload);
  });

  registerIpcHandler('gallery:getImageData', async (_event, { photoId }) => {
    return getGalleryImageData(photoId);
  });

  registerIpcHandler('gallery:openPhoto', async (_event, { photoId }) => {
    const viewer = await openGalleryPhotoViewer(photoId);
    return { success: true, data: viewer };
  });

  registerIpcHandler('gallery:showPhoto', async (_event, { photoId }) => {
    return showGalleryPhoto(photoId);
  });

  registerIpcHandler('gallery:toggleFavorite', async (_event, { photoId, favorite }) => {
    return toggleGalleryPhotoFavorite(photoId, favorite);
  });

  registerIpcHandler('gallery:nameFace', async (_event, { clusterId, name, relationship }) => {
    return nameGalleryFace(clusterId, name, relationship);
  });

  registerIpcHandler('gallery:setFaceRelationship', async (_event, { identityId, relationship }) => {
    return setGalleryFaceRelationship(identityId, relationship);
  });

  registerIpcHandler('gallery:updateFacePerson', async (_event, { identityId, name, relationship }) => {
    return updateGalleryFacePerson(identityId, name, relationship);
  });

  registerIpcHandler('gallery:deleteFacePerson', async (_event, { identityId }) => {
    return deleteGalleryFacePerson(identityId);
  });

  registerIpcHandler('gallery:addFaceToPerson', async (_event, { clusterId, identityId }) => {
    return addGalleryFaceToPerson(clusterId, identityId);
  });

  registerIpcHandler('gallery:removeFaceCluster', async (_event, { clusterId }) => {
    return removeGalleryFaceCluster(clusterId);
  });

  registerIpcHandler('gallery:scanPeople', async (_event, payload) => {
    return scanGalleryPeople(payload);
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
  teardownVoiceCaptureIPC();
  ipcRegistered = false;
}

async function destroyAssistantInstance() {
  if (diagnosticsManager) {
    try {
      diagnosticsManager.stop();
    } catch (error) {
      mainLogger.warn('Failed to stop voice diagnostics', { error: error.message });
    }
    diagnosticsManager = null;
  }
  if (voiceAssistantBridge) {
    try {
      voiceAssistantBridge.detach();
    } catch (error) {
      mainLogger.warn('Failed to detach voice assistant bridge', { error: error.message });
    }
    voiceAssistantBridge = null;
  }
  if (voiceOverlay) {
    try {
      voiceOverlay.detach();
      voiceOverlay.windowController?.destroy?.();
    } catch (error) {
      mainLogger.warn('Failed to destroy voice overlay', { error: error.message });
    }
    voiceOverlay = null;
  }
  destroyVoiceCaptureWindow();
  if (voiceSessionManager) {
    try {
      voiceSessionManager.destroy?.('assistant-destroy');
    } catch (error) {
      mainLogger.warn('Failed to destroy voice session resources', { error: error.message });
    }
  }
  voiceSessionManager = null;

  if (!assistant) {
    return;
  }

  const currentAssistant = assistant;
  assistant = null;
  try {
    await currentAssistant.destroy?.();
  } catch (error) {
    mainLogger.error('Assistant cleanup failed', { error: error.message });
  }
}

function destroyTextToSpeech() {
  if (!textToSpeech) {
    return;
  }

  try {
    textToSpeech.destroy();
  } catch (error) {
    mainLogger.error('TTS cleanup failed', { error: error.message });
  } finally {
    textToSpeech = null;
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
    stopDesktopChatReceiveRuntime();
    unregisterChatShortcut();
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
    destroyTextToSpeech();
    await destroyAssistantInstance();
    if (visualMemoryEngine) {
      try {
        await visualMemoryEngine.api.shutdown();
      } catch (error) {
        mainLogger.error('[VISUAL-MEMORY] Cleanup failed', { error: error.message });
      } finally {
        visualMemoryEngine = null;
        visualMemoryDefaultFoldersReady = false;
        visualMemoryIndexPromise = null;
        lazyVisualMemoryApi = null;
        visualMemoryReadyLogged = false;
      }
    }
    eventBus?.removeAllListeners?.();
    if (chatWindow && !chatWindow.isDestroyed()) chatWindow.destroy();
    if (timerWidgetWindow && !timerWidgetWindow.isDestroyed()) timerWidgetWindow.destroy();
    if (plannerWindow && !plannerWindow.isDestroyed()) plannerWindow.destroy();
    if (galleryWindow && !galleryWindow.isDestroyed()) galleryWindow.destroy();
    destroyVoiceCaptureWindow();
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

function getVoiceShortcuts() {
  const primary = runtimeConfig?.voice?.activationShortcut || BASE_CONFIG.voice?.activationShortcut || 'Alt+Space';
  const fallbacks = runtimeConfig?.voice?.activationFallbackShortcuts
    || BASE_CONFIG.voice?.activationFallbackShortcuts
    || [];

  return [...new Set([primary, ...fallbacks].filter(Boolean))]
    .filter(shortcut => shortcut !== 'Control+Space');
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

function quietMediaForVoiceActivation(shortcut = '') {
  const mediaController = assistant?.automation?.media;
  if (!mediaController || typeof mediaController.quietForVoiceActivation !== 'function') {
    return { success: true, skipped: true, reason: 'media-controller-unavailable' };
  }

  try {
    const result = mediaController.quietForVoiceActivation('voice-hotkey');
    const action = result?.data?.action || 'unknown';
    if (result?.success && action !== 'none') {
      if (result.data?.restore?.action) {
        voiceMediaQuietingState = {
          result,
          shortcut,
          startedAt: Date.now()
        };
      }
      mainLogger.info('Media quieted for voice listening', {
        shortcut,
        action,
        method: result.data?.method,
        playbackStatus: result.data?.playbackStatus,
        sourceAppUserModelId: result.data?.sourceAppUserModelId
      });
    } else if (!result?.success) {
      mainLogger.warn('Media quieting for voice listening failed', {
        shortcut,
        error: result?.error || 'Unknown media quieting failure',
        method: result?.data?.method
      });
    }
    return result || { success: true, skipped: true, reason: 'empty-media-result' };
  } catch (error) {
    mainLogger.warn('Media quieting for voice listening crashed safely', {
      shortcut,
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

function restoreMediaAfterVoiceSession(reason = 'voice-session-closed') {
  const state = voiceMediaQuietingState;
  voiceMediaQuietingState = null;
  if (!state?.result?.data?.restore?.action) {
    return { success: true, skipped: true, reason: 'no-media-quieting-state' };
  }

  const mediaController = assistant?.automation?.media;
  if (!mediaController || typeof mediaController.restoreAfterVoiceActivation !== 'function') {
    return { success: false, error: 'Media controller unavailable for restore' };
  }

  try {
    const result = mediaController.restoreAfterVoiceActivation(state.result, reason);
    const action = result?.data?.action || 'unknown';
    if (result?.success && action !== 'none') {
      mainLogger.info('Media restored after voice listening', {
        action,
        method: result.data?.method,
        reason,
        sourceAppUserModelId: result.data?.sourceAppUserModelId,
        quietedForMs: Math.max(0, Date.now() - Number(state.startedAt || Date.now()))
      });
    } else if (!result?.success) {
      mainLogger.warn('Media restore after voice listening failed', {
        reason,
        error: result?.error || 'Unknown media restore failure',
        method: result?.data?.method
      });
    }
    return result || { success: true, skipped: true, reason: 'empty-media-restore-result' };
  } catch (error) {
    mainLogger.warn('Media restore after voice listening crashed safely', {
      reason,
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

function isVoiceAssistantSpeaking() {
  return Boolean(
    textToSpeech?.isSpeaking ||
    textToSpeech?.activeProcess
  );
}

function handleVoiceShortcutDuringSpeaking(shortcut = '') {
  const state = voiceSessionManager?.getCurrentState?.();
  if (state !== 'SPEAKING' && !isVoiceAssistantSpeaking()) return null;

  const now = Date.now();
  const sessionId = voiceSessionManager?.getSession?.()?.sessionId || 'voice-session';
  const isSecondTap = voiceSpeakingStopSessionId === sessionId &&
    now - voiceSpeakingStopTapAt <= VOICE_SPEAKING_DOUBLE_TAP_MS;

  if (isSecondTap) {
    voiceSpeakingStopTapAt = 0;
    voiceSpeakingStopSessionId = null;
    const cancelled = voiceSessionManager.cancelSession('Voice shortcut double tapped while assistant was speaking.');
    mainLogger.info('Voice shortcut cancelled speaking session on second tap', { shortcut, sessionId });
    return { success: true, cancelled: true, stoppedSpeaking: true, state: cancelled.state };
  }

  voiceSpeakingStopTapAt = now;
  voiceSpeakingStopSessionId = sessionId;
  const stopped = voiceAssistantBridge?.coordinator?.stopSpeaking?.('voice-shortcut-stop-speaking')
    || { stopped: false };
  if (!stopped.stopped && textToSpeech) {
    textToSpeech.stop();
  }
  mainLogger.info('Voice shortcut stopped assistant speech', {
    shortcut,
    sessionId,
    stopped: Boolean(stopped.stopped)
  });
  return { success: true, stoppedSpeaking: true, cancelled: false, state };
}

function startVoiceListeningFromShortcut(shortcut = '') {
  if (!voiceSessionManager) {
    mainLogger.warn('Voice shortcut ignored because voice session manager is unavailable', { shortcut });
    return { success: false, error: 'Voice unavailable' };
  }

  try {
    const dismissedSearchResult = voiceOverlay?.windowController?.dismissAssistantResultForIntent?.('browser.search', {
      statusText: 'Search closed',
      icon: 'SE',
      hideAfterMs: 0
    });
    if (dismissedSearchResult?.dismissed) {
      mainLogger.info('Voice shortcut dismissed persistent browser search result', { shortcut });
    }

    const speakingAction = handleVoiceShortcutDuringSpeaking(shortcut);
    if (speakingAction) return speakingAction;

    const now = Date.now();
    if (voiceSessionManager.isActive()) {
      if ((now - voiceLastStartAt) < VOICE_ACTIVE_CANCEL_GRACE_MS) {
        mainLogger.info('Voice shortcut ignored during initial activation grace window', {
          shortcut,
          elapsedMs: now - voiceLastStartAt
        });
        return { success: false, ignored: true, reason: 'voice-activation-grace-window' };
      }
      voiceSpeakingStopTapAt = 0;
      voiceSpeakingStopSessionId = null;
      const cancelled = voiceSessionManager.cancelSession('Voice shortcut pressed while listening.');
      mainLogger.info('Voice shortcut cancelled active listening session', { shortcut });
      return { success: true, cancelled: true, state: cancelled.state };
    }

    if (voiceStartInFlight || (now - voiceLastStartAt) < VOICE_SHORTCUT_DEBOUNCE_MS) {
      mainLogger.info('Voice shortcut ignored while startup is settling', {
        shortcut,
        inFlight: voiceStartInFlight,
        elapsedMs: now - voiceLastStartAt
      });
      return { success: false, ignored: true, reason: 'voice-startup-in-flight' };
    }

    voiceStartInFlight = true;
    voiceLastStartAt = now;
    voiceSpeakingStopTapAt = 0;
    voiceSpeakingStopSessionId = null;
    if (chatWindow && !chatWindow.isDestroyed() && chatWindow.isVisible()) {
      chatWindow.hide();
    }

    prewarmVoiceRuntime('voice-shortcut');
    const started = voiceSessionManager.startSession({ id: `voice-shortcut-${Date.now()}` });
    try {
      quietMediaForVoiceActivation(shortcut);
      voiceSessionManager.startSpeechToText();
      voiceSessionManager.startAudioCapture();
    } catch (captureError) {
      mainLogger.warn('Voice shortcut started session but capture could not start', {
        shortcut,
        error: captureError.message
      });
      voiceSessionManager.failSession(captureError);
      return { success: false, state: voiceSessionManager.getCurrentState(), error: captureError.message };
    }
    mainLogger.info('Voice shortcut started listening', { shortcut });
    return { success: true, state: started.state };
  } catch (error) {
    mainLogger.error('Voice shortcut failed', { shortcut, error: error.message });
    try {
      voiceSessionManager?.reset?.();
    } catch (resetError) {
      mainLogger.warn('Voice shortcut recovery reset failed', { error: resetError.message });
    }
    return { success: false, error: error.message };
  } finally {
    voiceStartInFlight = false;
  }
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

  for (const shortcut of getVoiceShortcuts()) {
    try {
      const registered = globalShortcut.register(shortcut, () => {
        mainLogger.info('Voice shortcut pressed', { shortcut });
        startVoiceListeningFromShortcut(shortcut);
      });

      if (!registered) {
        mainLogger.error('Failed to register voice shortcut', { shortcut });
        continue;
      }

      registeredChatShortcuts.push(shortcut);
      mainLogger.info('Registered voice shortcut', { shortcut });
    } catch (error) {
      mainLogger.error('Invalid voice shortcut', { shortcut, error: error.message });
    }
  }
}

async function initializeAssistant() {
  ensureDataDir();
  runtimeConfig = settingsService.buildRuntimeConfig();
  runtimeConfig = {
    ...runtimeConfig,
    desktopActions: {
      ...(runtimeConfig.desktopActions || {}),
      openGallery: (view = 'timeline') => createGalleryWindow(view, { lowerChat: true }),
      openPeopleChat: () => createPeopleChatWindow(),
      sendOpenXChatMessage: payload => sendDesktopChatMessageToContact(payload || {})
    },
    visualMemoryApi: getLazyVisualMemoryApi()
  };
  assistant = new Assistant(runtimeConfig, { eventBus, visualMemoryApi: runtimeConfig.visualMemoryApi });
  assistant.router.permissionValidator.setUserLevel(
    settingsService.getSettings().system.permissionLevel
  );

  textToSpeech = new TextToSpeech(runtimeConfig);
  textToSpeech.initialize()
    .then(result => {
      voiceTtsSummary = result && typeof result === 'object'
        ? result
        : {
          role: 'text-to-speech',
          engine: 'windows-sapi',
          voice: textToSpeech?.voiceName || 'unknown',
          voiceCount: textToSpeech?.availableVoices?.length || 0
        };
      logVoiceModelSummaryOnce('tts-ready');
    })
    .catch(err => {
      voiceTtsSummary = {
        role: 'text-to-speech',
        engine: 'windows-sapi',
        ready: false,
        error: err.message
      };
      mainLogger.warn('TTS initialization failed (non-fatal)', { error: err.message });
      logVoiceModelSummaryOnce('tts-failed');
    });

  const voiceResources = createDesktopVoiceResources();
  logVoiceModelSummaryOnce('assistant-startup');
  voiceSessionManager = new VoiceSessionManager({
    logger: mainLogger,
    resources: voiceResources
  });
  voiceSessionManager.on(SESSION_EVENTS.VOICE_SESSION_CLOSED, event => {
    restoreMediaAfterVoiceSession(event?.session?.currentState || event?.state || 'voice-session-closed');
  });
  voiceOverlay = createVoiceOverlayForManager(voiceSessionManager);
  voiceAssistantBridge = new VoiceAssistantBridge({
    manager: voiceSessionManager,
    assistant,
    textToSpeech,
    logger: mainLogger
  });
  voiceAssistantBridge.on(VOICE_INTEGRATION_EVENTS.VOICE_RESPONSE_READY, event => {
    try {
      voiceOverlay?.displayAssistantResult?.(event?.result || {});
    } catch (error) {
      mainLogger.warn('Voice overlay assistant result display failed', { error: error.message });
    }
  });
  diagnosticsManager = new DiagnosticsManager({
    logger: mainLogger,
    configuration: {
      ...(runtimeConfig?.voice?.diagnostics || {}),
      storageRoot: runtimeConfig.app.dataPaths.voiceDiagnosticsDir
    }
  });
  diagnosticsManager.start({
    sessionManager: voiceSessionManager,
    resources: { sessionManager: voiceSessionManager, ...voiceResources }
  });
  scheduleVoiceRuntimePrewarm('assistant-idle-prewarm');
  scheduleVoiceResourceWarmup('desktop-idle-warmup');

  registerChatShortcut();
  mainLogger.info('Assistant initialized', {
    name: runtimeConfig?.assistant?.displayName || 'OpenX'
  });
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

  destroyTextToSpeech();
  await destroyAssistantInstance();
  await initializeAssistant();

  if (tray) {
    tray.setToolTip(`${runtimeConfig?.assistant?.displayName || 'OpenX'} Assistant`);
  }

  if (chatWindow?.webContents) {
    chatWindow.webContents.send('settings:changed', buildSettingsSnapshot());
  }

  restoreLiveScheduleInDynamicIsland();
}

function registerPowerRecoveryHandlers() {
  if (powerRecoveryHandlersRegistered || !powerMonitor || typeof powerMonitor.on !== 'function') return;
  powerRecoveryHandlersRegistered = true;

  powerMonitor.on('suspend', () => {
    mainLogger.info('System suspend detected; pausing voice runtime');
    resetVoiceRuntimeAfterPowerEvent('system-suspend');
  });

  powerMonitor.on('resume', () => {
    mainLogger.info('System resume detected; scheduling voice recovery');
    scheduleVoiceResumeRecovery('system-resume');
  });

  powerMonitor.on('unlock-screen', () => {
    mainLogger.info('Screen unlock detected; refreshing voice runtime');
    scheduleVoiceResumeRecovery('screen-unlock');
  });
}

function isTrustedVoiceOverlayIpcSender(event, channel) {
  if (![
    'schedule:alertAction',
    'cloud:fileTransferAction',
    'desktopChat:quickReply',
    'voiceOverlay:collapse',
    'voiceOverlay:expandLiveSchedule'
  ].includes(channel)) return false;
  const overlayContents = voiceOverlay?.windowController?.window?.webContents;
  if (!overlayContents || event?.sender?.id !== overlayContents.id) return false;
  const senderUrl = getIpcSenderUrl(event);
  return typeof senderUrl === 'string' && senderUrl.startsWith('data:text/html');
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
    voiceState: voiceSessionManager?.getCurrentState?.() || '',
    windows: {
      chat: Boolean(chatWindow && !chatWindow.isDestroyed()),
      voice: Boolean(voiceOverlay?.windowController?.window && !voiceOverlay.windowController.window.isDestroyed()),
      planner: Boolean(plannerWindow && !plannerWindow.isDestroyed()),
      gallery: Boolean(galleryWindow && !galleryWindow.isDestroyed()),
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
  if (activeLiveSchedulePayload && String(details.type || '').toLowerCase().includes('renderer')) {
    const token = setTimeout(() => {
      recoveryTimeouts.delete(token);
      restoreLiveScheduleInDynamicIsland();
    }, 1200);
    recoveryTimeouts.add(token);
    if (typeof token.unref === 'function') token.unref();
  }
});

app.whenReady().then(async () => {
  disableSpellChecker();
  configureSessionSecurity();
  settingsService = new SettingsService(BASE_CONFIG);
  runtimeConfig = settingsService.buildRuntimeConfig();
  eventBus = new AssistantEventBus();
  eventBus.subscribe(EVENTS.SCHEDULE_DUE, envelope => {
    if (['timer', 'alarm'].includes(String(envelope.payload?.kind || '').toLowerCase())) {
      clearLiveScheduleActivity(envelope.payload);
    }
    presentScheduleInDynamicIsland(envelope.payload);
    sendPlannerEntries('calendar');
    sendScheduleActivitySnapshot('schedule-due');
  });
  eventBus.subscribe(EVENTS.SCHEDULE_CHANGED, envelope => {
    sendPlannerEntries('calendar');
    sendScheduleActivitySnapshot('schedule-changed');
    broadcastScheduleSync(envelope.payload);
  });
  eventBus.subscribe(EVENTS.COMMAND_EXECUTED, envelope => handleTimerWidgetCommand(envelope.payload));
  eventBus.subscribe(EVENTS.COMMAND_EXECUTED, envelope => handleLiveScheduleCommand(envelope.payload));
  eventBus.subscribe(EVENTS.COMMAND_EXECUTED, envelope => handlePlannerCommand(envelope.payload));
  setupIPC();
  registerPowerRecoveryHandlers();
  createTray();
  await initializeAssistant();
  initializeCloudConnection();
  initializeCloudPairing();
  initializeCloudCommands();
  initializeCloudMobileRuntime();
  await maybeAutoConnectCloud('desktop-startup');
  restoreLiveScheduleInDynamicIsland();
  startDesktopChatReceiveRuntime({
    reason: 'desktop-startup',
    quietOffline: true,
    notify: true
  }).catch(error => {
    if (!isDesktopChatServerUnavailableError(error)) {
      mainLogger.warn('[CHAT] Chat receive startup failed', {
        code: error.code || 'chat.receive_start_failed',
        error: error.message
      });
    }
  });
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
