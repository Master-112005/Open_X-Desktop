const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, globalShortcut, session, screen, powerMonitor, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

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
const { ensureDataRoot, migrateLegacyData } = require('../../../core/assistant/Data');
const { CloudCommandManager, CloudConnectionManager, CloudFileTransferManager, CloudLogger, CloudPairingManager } = require('../../../core/cloud');
const { UpdateEngine } = require('../../../core/update');
const CrashRecoveryPolicy = require('./crash-recovery');
const WindowsIdentityVerifier = require('../identity-verification');
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

if (!app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('appData'), 'OpenX-Development'));
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
    if (chatWindow.isMinimized()) chatWindow.restore();
    chatWindow.show();
    chatWindow.focus();
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
const desktopStartupStartedAt = Date.now();
const crashRecoveryPolicy = new CrashRecoveryPolicy({
  statePath: path.join(BASE_CONFIG.app.dataPaths.runtimeDir, 'crash-recovery.json'),
  maxRestarts: 3,
  windowMs: 5 * 60 * 1000
});

let chatWindow = null;
let timerWidgetWindow = null;
let timerWidgetMode = null;
let plannerWindow = null;
let tray = null;
let assistant = null;
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
let identityVerificationService = null;
let cloudConnectionManager = null;
let cloudPairingManager = null;
let cloudCommandManager = null;
let cloudFileTransferManager = null;
let updateEngine = null;
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
const IPC_CHANNELS = [
  'command:process',
  'command:confirm',
  'assistant:status',
  'tts:speak',
  'tts:stop',
  'voice:start',
  'voiceOverlay:collapse',
  'window:openChat',
  'window:openSettings',
  'window:openPlanner',
  'window:closePlanner',
  'config:get',
  'settings:get',
  'update:status',
  'update:version',
  'update:diagnostics',
  'update:checkVersion',
  'update:getVersionStatus',
  'update:getVersionDiagnostics',
  'update:download:start',
  'update:download:pause',
  'update:download:resume',
  'update:download:cancel',
  'update:download:status',
  'update:download:diagnostics',
  'update:verify',
  'update:verification:status',
  'update:verification:diagnostics',
  'update:getPresentation',
  'update:getReleaseNotes',
  'update:getProgress',
  'update:getActions',
  'update:executeAction',
  'update:getStatus',
  'update:install',
  'update:cancelInstallation',
  'update:getInstallationStatus',
  'update:getInstallationDiagnostics',
  'update:selfUpdate',
  'update:selfUpdateStatus',
  'update:selfUpdateDiagnostics',
  'update:recoveryStatus',
  'update:recoveryDiagnostics',
  'update:rollbackHistory',
  'security:verifyAccess',
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

function createChatWindow() {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.setAlwaysOnTop(true);
    chatLoweredForPlanner = false;
    chatWindow.show();
    chatWindow.focus();
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

function scheduleVoiceRuntimePrewarm(reason = 'startup', delayMs = VOICE_IDLE_RUNTIME_PREWARM_DELAY_MS) {
  if (voiceCaptureWarmupTimer) {
    clearTimeout(voiceCaptureWarmupTimer);
    voiceCaptureWarmupTimer = null;
  }
  const warmupDelayMs = Math.max(0, Number(delayMs) || 0);
  voiceCaptureWarmupTimer = setTimeout(() => {
    voiceCaptureWarmupTimer = null;
    prewarmVoiceRuntime(reason);
  }, warmupDelayMs);
  if (typeof voiceCaptureWarmupTimer.unref === 'function') {
    voiceCaptureWarmupTimer.unref();
  }
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
  return settingsService.getSnapshot();
}

function getUpdateEngine() {
  if (!updateEngine) {
    updateEngine = new UpdateEngine({
      config: runtimeConfig || settingsService?.buildRuntimeConfig?.() || BASE_CONFIG,
      relayClientProvider: () => cloudConnectionManager,
      logger: mainLogger,
      installationConfirmationHandler: confirmUpdateInstallation,
      installationSaveHandlers: [saveStateForUpdateInstallation],
      installationShutdownHandlers: [prepareRuntimeForUpdateInstallation],
      selfUpdateSaveHandlers: [saveStateForSelfUpdate],
      selfUpdateShutdownHandlers: [prepareRuntimeForSelfUpdate],
      selfUpdateRestoreHandlers: [restoreRuntimeAfterSelfUpdate],
      recoveryBackupPathsProvider: buildRecoveryBackupPaths,
      recoveryRestoreHandlers: [restoreRuntimeAfterRecovery],
      restartOptions: buildSelfUpdateRestartOptions()
    });
  }
  updateEngine.setRelayClient?.(() => cloudConnectionManager);
  updateEngine.setUpdateNotificationDisplayHandler?.((card, event) => presentUpdateAvailableInDynamicIsland(event, card));
  updateEngine.setUpdateNotificationAckSender?.((event, stage, status, details) => (
    cloudConnectionManager?.acknowledgeUpdateEvent?.(event.eventId, stage, status, details) === true
  ));
  return updateEngine;
}

function ensureUpdateEngineInitialized() {
  const engine = getUpdateEngine();
  if (!engine.isInitialized()) {
    const result = engine.initialize();
    if (!result.success) return result;
  }
  return null;
}

async function executeUpdatePresentationAction(actionId, payload = {}) {
  const result = await getUpdateEngine().executePresentationAction(actionId, payload);
  if (actionId === 'install' && result?.data?.result?.type === 'installation.launched') {
    scheduleQuitAfterInstallerLaunch();
  }
  if (actionId === 'selfUpdate' && result?.data?.result?.type === 'selfUpdate.completed') {
    scheduleQuitAfterSelfUpdateRestart();
  }
  const dataPath = result?.data?.result?.data?.path || result?.data?.path || '';
  if (result?.success !== false && dataPath && ['openDownloadsFolder', 'openLogsFolder'].includes(actionId)) {
    try {
      await shell.openPath(dataPath);
    } catch (error) {
      mainLogger.warn('Update presentation folder open failed', { actionId, path: dataPath, error: error.message });
    }
  }
  return result;
}

function buildSelfUpdateRestartOptions() {
  return {
    executablePath: process.execPath,
    args: process.argv.slice(1),
    cwd: process.cwd(),
    env: { ...process.env }
  };
}

function buildRecoveryBackupPaths() {
  const candidates = new Set();
  try {
    candidates.add(process.execPath);
  } catch (_) {}
  try {
    candidates.add(app.getAppPath());
  } catch (_) {}
  try {
    if (app.isPackaged && process.resourcesPath) {
      candidates.add(path.join(process.resourcesPath, 'app.asar'));
      candidates.add(path.join(process.resourcesPath, 'app.asar.unpacked'));
    }
  } catch (_) {}
  return Array.from(candidates)
    .filter(Boolean)
    .filter(candidate => {
      try {
        return fs.existsSync(candidate);
      } catch (_) {
        return false;
      }
    })
    .map(candidate => ({ path: candidate, alias: path.basename(candidate) }));
}

async function confirmUpdateInstallation(request = {}) {
  const version = request?.session?.installerVersion || 'unknown';
  const message = `Version ${version} has been downloaded and verified.\n\nOpenX must close to launch the verified installer.`;
  const response = await dialog.showMessageBox({
    type: 'question',
    title: 'OpenX Update Ready',
    message: 'OpenX Update Ready',
    detail: `${message}\n\nInstallation will not start unless you choose Install Now.`,
    buttons: ['Install Now', 'Later'],
    defaultId: 1,
    cancelId: 1,
    noLink: true
  });
  return {
    confirmed: response.response === 0,
    reason: response.response === 0 ? 'confirmed' : 'user_cancelled'
  };
}

async function saveStateForUpdateInstallation() {
  try {
    settingsService?.saveSettings?.(settingsService.getSettings());
  } catch (error) {
    mainLogger.warn('Settings save before update installation failed', { error: error.message });
    throw error;
  }
}

async function saveStateForSelfUpdate(context = {}) {
  await saveStateForUpdateInstallation(context);
  try {
    mainLogger.info('Self-update state preservation completed', {
      sessionId: context.session?.sessionId || null,
      targetVersion: context.session?.targetVersion || null
    });
  } catch (_) {}
}

async function prepareRuntimeForUpdateInstallation() {
  try {
    await cloudConnectionManager?.disconnect?.();
  } catch (error) {
    mainLogger.warn('Cloud disconnect before update installation failed', { error: error.message });
  }
  try {
    voiceSessionManager?.cancelSession?.('update-installation');
  } catch (error) {
    mainLogger.warn('Voice cancellation before update installation failed', { error: error.message });
  }
}

async function prepareRuntimeForSelfUpdate(context = {}) {
  await prepareRuntimeForUpdateInstallation(context);
  try {
    if (chatWindow && !chatWindow.isDestroyed()) chatWindow.hide();
    if (plannerWindow && !plannerWindow.isDestroyed()) plannerWindow.hide();
    if (timerWidgetWindow && !timerWidgetWindow.isDestroyed()) timerWidgetWindow.hide();
  } catch (error) {
    mainLogger.warn('Window hide before self update failed', { error: error.message });
  }
  try {
    mainLogger.info('Runtime prepared for silent self update', {
      sessionId: context.session?.sessionId || null,
      targetVersion: context.session?.targetVersion || null
    });
  } catch (_) {}
}

async function restoreRuntimeAfterSelfUpdate(context = {}) {
  try {
    mainLogger.info('Self-update restart launched; restoration metadata recorded', {
      sessionId: context.session?.sessionId || null,
      targetVersion: context.session?.targetVersion || null,
      restartPid: context.restart?.pid || null
    });
  } catch (_) {}
}

async function restoreRuntimeAfterRecovery(context = {}) {
  try {
    mainLogger.warn('Update recovery restored previous application files', {
      sessionId: context.session?.sessionId || null,
      rollbackBackupId: context.rollback?.backupId || null,
      restoredFiles: context.rollback?.restored?.length || 0
    });
  } catch (_) {}
}

async function validateUpdateRecoveryStartup() {
  const initializationError = ensureUpdateEngineInitialized();
  if (initializationError) return initializationError;
  return getUpdateEngine().validateStartup({
    applicationStarted: true,
    servicesInitialized: true,
    coreModulesInitialized: true,
    assistantInitialized: Boolean(assistant),
    ipcInitialized: ipcRegistered,
    configurationLoaded: Boolean(runtimeConfig),
    mainWindowCreated: app.isPackaged ? true : Boolean(chatWindow && !chatWindow.isDestroyed()),
    startupDurationMs: Date.now() - desktopStartupStartedAt,
    responsive: true,
    criticalModulesLoaded: true,
    initializationCompleted: true,
    fatalStartupErrors: [],
    fatalExceptions: [],
    healthDurationMs: 0
  });
}

async function handleStartupFailureWithRecovery(error) {
  try {
    if (!settingsService) settingsService = new SettingsService(BASE_CONFIG);
    if (!runtimeConfig) runtimeConfig = settingsService.buildRuntimeConfig();
    const initializationError = ensureUpdateEngineInitialized();
    if (!initializationError) {
      const recovery = await getUpdateEngine().handleStartupFailure(error, {
        restartOptions: buildSelfUpdateRestartOptions(),
        fatalStartupErrors: [error]
      });
      if (recovery?.success === true) {
        mainLogger.warn('Startup failure triggered update rollback recovery', { type: recovery.type });
        scheduleQuitAfterSelfUpdateRestart();
        return;
      }
    }
  } catch (recoveryError) {
    mainLogger.error('Startup update recovery failed', { error: recoveryError.message });
  }
  handleFatalError(error, 'startup');
}

function scheduleQuitAfterInstallerLaunch() {
  setTimeout(() => {
    try {
      app.quit();
    } catch (error) {
      mainLogger.warn('App quit after installer launch failed', { error: error.message });
    }
  }, 250);
}

function scheduleQuitAfterSelfUpdateRestart() {
  setTimeout(() => {
    try {
      app.exit(0);
    } catch (error) {
      mainLogger.warn('App exit after self-update restart failed', { error: error.message });
    }
  }, 250);
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
    mainLogger.info('Voice STT model path resolved', {
      modelPath,
      sourceCount: candidateRoots.length
    });
    return modelPath;
  }

  const fallbackPath = path.resolve(__dirname, '..', '..', '..', 'models', 'parakeet');
  mainLogger.warn('Voice STT model path could not be validated; using fallback path', {
    fallbackPath,
    checked: candidateRoots
  });
  return fallbackPath;
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
  const sttEngine = new STTEngine({
    configuration: new STTConfiguration({
      modelPath: resolveDesktopSttModelPath()
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

function formatScheduleDueLabel(schedule = {}) {
  const due = new Date(schedule.dueAt || Date.now());
  if (Number.isNaN(due.getTime())) return 'Due now';
  return due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

function presentScheduleInDynamicIsland(schedule = {}) {
  if (!voiceOverlay || typeof voiceOverlay.displayAssistantResult !== 'function') return false;
  const kind = String(schedule.kind || 'Schedule').trim() || 'Schedule';
  const message = String(schedule.message || schedule.title || `${kind} is due`).trim();
  const dueLabel = formatScheduleDueLabel(schedule);
  try {
    voiceOverlay.displayAssistantResult({
      success: true,
      intent: 'schedule.due',
      response: `${kind}: ${message}`,
      data: {
        schedule: {
          ...schedule,
          dueLabel
        },
        actions: buildScheduleDynamicIslandActions(schedule),
        resultEntries: [{
          index: 1,
          name: message,
          type: kind.toLowerCase(),
          location: dueLabel,
          snippet: schedule.recurrence ? `Repeats ${String(schedule.recurrence).replace(/-/g, ' ')}` : ''
        }]
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
  const sourceName = String(
    notification.sourceDeviceName ||
    notification.deviceName ||
    metadata.deviceName ||
    notification.details?.deviceName ||
    'Mobile'
  ).replace(/\s+/g, ' ').trim().slice(0, 80);
  const appName = String(
    notification.appName ||
    notification.packageName ||
    notification.details?.appName ||
    notification.category ||
    'Notification'
  ).replace(/\s+/g, ' ').trim().slice(0, 80);
  const title = String(notification.title || appName || 'Notification').replace(/\s+/g, ' ').trim().slice(0, 140);
  const message = String(notification.message || notification.text || notification.body || '').replace(/\s+/g, ' ').trim().slice(0, 360);
  const packageName = String(notification.packageName || notification.details?.packageName || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const repeatCount = Math.max(1, Math.round(Number(notification.repeatCount || notification.details?.repeatCount) || 1));
  return {
    notificationId: String(notification.notificationId || notification.id || `phone_notification_${Date.now()}`).trim(),
    sourceName,
    appName,
    packageName,
    title,
    message,
    receivedAt: notification.createdAt || notification.timestamp || Date.now(),
    priority: String(notification.priority || 'normal').toLowerCase(),
    repeatCount,
    groupKey: String(notification.details?.groupKey || packageName || appName || sourceName).toLowerCase()
  };
}

const PHONE_NOTIFICATION_BURST_WINDOW_MS = 900;
const PHONE_NOTIFICATION_MAX_GROUP_ITEMS = 5;
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
  const maxPriority = notifications.some(item => item.priority === 'critical')
    ? 'critical'
    : notifications.some(item => item.priority === 'high') ? 'high' : primary.priority;

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
          ? `${primary.appName} • ${totalCount} notifications`
          : `${primary.appName} from ${primary.sourceName}`,
        preExpandDelayMs: grouped ? 350 : 650,
        autoHideMs: maxPriority === 'critical' ? 0 : maxPriority === 'high' ? 20000 : 14000,
        persistUntilAction: maxPriority === 'critical'
      }
    });
    return true;
  } catch (error) {
    mainLogger.warn('Dynamic Island phone notification failed', { error: error.message });
    return false;
  }
}

function presentPhoneNotificationInDynamicIsland(notification = {}, metadata = {}) {
  const normalized = normalizePhoneNotification(notification, metadata);
  const key = phoneNotificationGroupKey(normalized);
  const group = phoneNotificationGroups.get(key) || { notifications: new Map(), timer: null };
  group.notifications.set(normalized.notificationId, normalized);
  if (group.timer) clearTimeout(group.timer);
  group.timer = setTimeout(() => displayPhoneNotificationGroup(key), PHONE_NOTIFICATION_BURST_WINDOW_MS);
  group.timer.unref?.();
  phoneNotificationGroups.set(key, group);
  if (normalized.priority === 'critical') {
    clearTimeout(group.timer);
    group.timer = null;
    return displayPhoneNotificationGroup(key);
  }
  return true;
}

function presentCloudPhoneCommandInDynamicIsland(event = {}) {
  if (!voiceOverlay || typeof voiceOverlay.displayAssistantResult !== 'function') return false;
  const request = event.request || {};
  const deviceName = String(event.deviceName || request.deviceName || 'Mobile').replace(/\s+/g, ' ').trim().slice(0, 80);
  const command = String(event.command || request.command || '').replace(/\s+/g, ' ').trim().slice(0, 280);
  if (!command) return false;
  try {
    voiceOverlay.displayAssistantResult({
      success: true,
      intent: 'phone.cloudCommand',
      response: command,
      data: {
        resultEntries: [{
          index: 1,
          name: command,
          type: 'phone command',
          location: deviceName,
          snippet: 'Processing through OpenX Desktop.'
        }]
      },
      ui: {
        icon: 'PH',
        previewStatus: `${deviceName} sent a command`,
        preExpandDelayMs: 250,
        autoHideMs: 2600
      }
    });
    return true;
  } catch (error) {
    mainLogger.warn('Dynamic Island cloud command popup failed', { error: error.message });
    return false;
  }
}

function presentCloudPhoneResultInDynamicIsland(event = {}) {
  if (!voiceOverlay || typeof voiceOverlay.displayAssistantResult !== 'function') return false;
  const request = event.request || {};
  const result = event.result && typeof event.result === 'object' ? event.result : {};
  const deviceName = String(event.deviceName || request.deviceName || 'Mobile').replace(/\s+/g, ' ').trim().slice(0, 80);
  const response = String(result.response || result.message || (event.status === 'completed' ? 'Command completed.' : 'Command failed.'))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 420);
  try {
    voiceOverlay.displayAssistantResult({
      ...result,
      response,
      message: response,
      intent: result.intent || 'phone.cloudResult',
      success: result.success !== false && event.status === 'completed',
      data: result.data || null,
      ui: {
        ...(result.ui || {}),
        icon: 'PH',
        previewStatus: `Reply for ${deviceName}`,
        preExpandDelayMs: 420,
        autoHideMs: result.needsClarification ? 22000 : 14000
      }
    });
    return true;
  } catch (error) {
    mainLogger.warn('Dynamic Island cloud result popup failed', { error: error.message });
    return false;
  }
}

function presentUpdateAvailableInDynamicIsland(event = {}, card = null) {
  if (!voiceOverlay || typeof voiceOverlay.displayAssistantResult !== 'function') return false;
  if (!card) {
    try {
      card = getUpdateEngine().getPresentation({ source: 'dynamic-island' })?.data?.card || null;
    } catch (_) {
      card = null;
    }
  }
  const latestVersion = String(event.latestVersion || card?.notification?.latestVersion || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  const hasPresentationCard = card?.intent === 'update.presentation';
  if (!latestVersion && !hasPresentationCard) return false;
  const releaseNotes = String(event.releaseNotes || '').replace(/\s+/g, ' ').trim().slice(0, 500);
  try {
    voiceOverlay.displayAssistantResult(card || {
      success: true,
      intent: 'update.available',
      response: `Version ${latestVersion} Available`,
      data: {
        actions: [],
        buttons: [],
        resultEntries: [{
          index: 1,
          name: `Version ${latestVersion}`,
          type: 'OpenX update',
          location: String(event.channel || 'stable').slice(0, 80),
          snippet: releaseNotes || (event.mandatory ? 'Mandatory update available.' : 'Update available.')
        }]
      },
      ui: {
        icon: 'UP',
        previewStatus: 'OpenX update available',
        preExpandDelayMs: 450,
        autoHideMs: event.mandatory ? 30000 : 18000,
        persistUntilAction: false
      }
    });
    return true;
  } catch (error) {
    mainLogger.warn('Dynamic Island update notification failed', { error: error.message });
    return false;
  }
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
  if (!/^(?:timer|stopwatch)\./.test(intent)) return;
  if (intent === 'timer.cancel' || intent === 'timer.clear' || intent === 'stopwatch.cancel') {
    hideTimerWidget();
    return;
  }
  const preferredId = payload.data?.id || payload.data?.taskName || null;
  if (intent === 'timer.set' || intent === 'timer.reset' || intent === 'stopwatch.start' || intent === 'stopwatch.reset') {
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
    logger: cloudLogger
  });
  cloudConnectionManager.on('status', status => sendCloudStatus(status));
  cloudConnectionManager.on('notification', notification => {
    if (String(notification?.category || '').toLowerCase() !== 'phone' && !notification?.details?.appName) return;
    presentPhoneNotificationInDynamicIsland(notification, { source: 'phone-cloud' });
  });
  cloudConnectionManager.on('update-available', event => {
    try {
      getUpdateEngine().handleUpdateAvailableEvent(event);
    } catch (error) {
      mainLogger.warn('Update availability event handling failed', { error: error.message });
    }
  });
  return cloudConnectionManager;
}

function initializeCloudPairing() {
  if (cloudPairingManager) return cloudPairingManager;
  const manager = initializeCloudConnection();
  cloudPairingManager = new CloudPairingManager({
    connectionManager: manager,
    logger: mainLogger,
    tokenTtlMs: runtimeConfig?.cloud?.pairTokenTtlMs || 5 * 60 * 1000
  });
  cloudPairingManager.on('request', status => {
    sendCloudPairingStatus(status);
    if (chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.show();
      chatWindow.focus();
    }
  });
  cloudPairingManager.on('result', result => {
    sendCloudPairingStatus();
    mainLogger.info('[CLOUD] Pairing result received', {
      pairRequestId: result?.pairRequestId,
      type: result?.type
    });
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
    presentCloudPhoneCommandInDynamicIsland(event);
  });
  cloudCommandManager.on('assistant-result', event => {
    presentCloudPhoneResultInDynamicIsland(event);
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
    const fileSize = Number(transfer.fileSize || 0);
    const message = `${transfer.fileName} (${Math.max(0, fileSize)} bytes) from cloud device ${transfer.sourceDeviceId}`;
    dialog.showMessageBox({
      type: 'question',
      buttons: ['Accept', 'Reject'],
      defaultId: 0,
      cancelId: 1,
      title: 'Incoming OpenX Cloud File',
      message: 'Accept incoming file transfer?',
      detail: message,
      noLink: true
    }).then(result => {
      if (result.response === 0) {
        cloudFileTransferManager?.acceptTransfer?.(transfer.transferId);
      } else {
        cloudFileTransferManager?.rejectTransfer?.(transfer.transferId, 'rejected-by-desktop');
      }
    }).catch(error => {
      mainLogger.warn('[CLOUD-FILE] Incoming transfer prompt failed', {
        transferId: transfer.transferId,
        error: error.message
      });
      cloudFileTransferManager?.rejectTransfer?.(transfer.transferId, 'prompt-failed');
    });
  });
  cloudFileTransferManager.on('progress', transfer => {
    mainLogger.info('[CLOUD-FILE] Transfer progress', {
      transferId: transfer.transferId,
      state: transfer.state,
      percent: transfer.percent
    });
    const busyStates = new Set(['pending', 'accepted', 'transferring', 'receiving']);
    if (busyStates.has(String(transfer.state || '').toLowerCase())) {
      manager.updatePresence?.('busy', { reason: 'file-transfer' });
    } else {
      manager.updatePresence?.('online', { reason: 'file-transfer-complete' });
    }
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

function coerceCloudTimestamp(value, fallback = Date.now()) {
  if (Number.isFinite(Number(value)) && Number(value) > 0) return Number(value);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function buildManagedDeviceList() {
  const manager = cloudConnectionManager || initializeCloudConnection();
  if (manager?.isConnected?.()) {
    try {
      await manager.listDevices();
    } catch (error) {
      mainLogger.warn('Cloud device list refresh failed; using cached devices', { error: error.message });
    }
  }
  const cloudStatus = cloudConnectionManager?.getStatus?.() || {};
  const cloudById = new Map((cloudStatus.pairedDevices || []).map(device => [device.deviceId, device]));
  const output = [];
  const currentDeviceId = cloudStatus.device?.deviceId || runtimeConfig?.cloud?.deviceId || '';

  for (const cloud of cloudById.values()) {
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
      chatWindow.show();
      chatWindow.focus();
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

  registerIpcHandler('window:openChat', async () => {
    createChatWindow();
  });

  registerIpcHandler('voice:start', async () => startVoiceListeningFromShortcut('chat-voice-button'));

  registerIpcHandler('window:openSettings', async () => {
    createSettingsWindow();
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
    return runtimeConfig;
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

  registerIpcHandler('update:status', async () => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().getStatus();
  });

  registerIpcHandler('update:version', async () => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().getVersion();
  });

  registerIpcHandler('update:diagnostics', async () => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().getDiagnostics();
  });

  registerIpcHandler('update:checkVersion', async () => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().checkVersionNow({ source: 'ipc' });
  });

  registerIpcHandler('update:getVersionStatus', async () => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().getVersionCheckStatus();
  });

  registerIpcHandler('update:getVersionDiagnostics', async () => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().getVersionCheckDiagnostics();
  });

  registerIpcHandler('update:download:start', async (_event, payload = {}) => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().startDownload(payload);
  });

  registerIpcHandler('update:download:pause', async (_event, payload = {}) => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().pauseDownload(payload.taskId);
  });

  registerIpcHandler('update:download:resume', async (_event, payload = {}) => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().resumeDownload(payload.taskId);
  });

  registerIpcHandler('update:download:cancel', async (_event, payload = {}) => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().cancelDownload(payload.taskId);
  });

  registerIpcHandler('update:download:status', async (_event, payload = {}) => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().getDownloadStatus(payload.taskId || '');
  });

  registerIpcHandler('update:download:diagnostics', async () => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().getDownloadDiagnostics();
  });

  registerIpcHandler('update:verify', async (_event, payload = {}) => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().verifyPackage(payload);
  });

  registerIpcHandler('update:verification:status', async () => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().getVerificationStatus();
  });

  registerIpcHandler('update:verification:diagnostics', async () => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().getVerificationDiagnostics();
  });

  registerIpcHandler('update:getPresentation', async (_event, context = {}) => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().getPresentation(context);
  });

  registerIpcHandler('update:getReleaseNotes', async () => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().getReleaseNotes();
  });

  registerIpcHandler('update:getProgress', async () => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().getProgress();
  });

  registerIpcHandler('update:getActions', async () => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().getActions();
  });

  registerIpcHandler('update:executeAction', async (_event, { actionId, payload } = {}) => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return executeUpdatePresentationAction(actionId, payload || {});
  });

  registerIpcHandler('update:getStatus', async () => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().getPresentationStatus();
  });

  registerIpcHandler('update:install', async (_event, payload = {}) => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    const result = await getUpdateEngine().install({ source: payload.source || 'ipc' });
    if (result?.type === 'installation.launched') scheduleQuitAfterInstallerLaunch();
    return result;
  });

  registerIpcHandler('update:cancelInstallation', async (_event, payload = {}) => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().cancelInstallation(payload.reason || 'cancelled');
  });

  registerIpcHandler('update:getInstallationStatus', async () => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().getInstallationStatus();
  });

  registerIpcHandler('update:getInstallationDiagnostics', async () => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().getInstallationDiagnostics();
  });

  registerIpcHandler('update:selfUpdate', async (_event, payload = {}) => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    const result = await getUpdateEngine().selfUpdate({
      source: payload.source || 'ipc',
      approved: true,
      restartOptions: buildSelfUpdateRestartOptions()
    });
    if (result?.type === 'selfUpdate.completed') scheduleQuitAfterSelfUpdateRestart();
    return result;
  });

  registerIpcHandler('update:selfUpdateStatus', async () => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().getSelfUpdateStatus();
  });

  registerIpcHandler('update:selfUpdateDiagnostics', async () => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().getSelfUpdateDiagnostics();
  });

  registerIpcHandler('update:recoveryStatus', async () => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().getRecoveryStatus();
  });

  registerIpcHandler('update:recoveryDiagnostics', async () => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().getRecoveryDiagnostics();
  });

  registerIpcHandler('update:rollbackHistory', async () => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().getRollbackHistory();
  });

  registerIpcHandler('security:verifyAccess', async () => {
    const verification = await identityVerificationService?.verifyIdentity?.();
    if (verification?.success !== true) {
      return { success: false, message: 'Windows identity verification required.' };
    }
    return { success: true };
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

  registerIpcHandler('cloud:pairingQR:create', async () => {
    const verification = await identityVerificationService?.verifyIdentity?.();
    if (verification?.success !== true) {
      return { success: false, message: 'Windows identity verification required.' };
    }
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
    return {
      ...buildSettingsSnapshot(),
      cloudStatus: manager.getStatus()
    };
  });

  registerIpcHandler('schedule:alertAction', async (_event, { id, action, minutes }) => {
    const scheduler = assistant?.automation?.scheduler;
    const result = action === 'snooze'
      ? scheduler?.snooze(id, minutes)
      : scheduler?.complete(id);
    if (result?.success && String(result.data?.kind || '').toLowerCase() === 'timer') {
      if (action === 'snooze') showTimerWidget(result.data.id || result.data.taskName || id);
      if (action === 'stop') hideTimerWidget();
    }
    return result || { success: false, error: 'Scheduler unavailable' };
  });

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
    for (const timeout of recoveryTimeouts) clearTimeout(timeout);
    recoveryTimeouts.clear();
    for (const timeout of unresponsiveTimeouts.values()) clearTimeout(timeout);
    unresponsiveTimeouts.clear();
    unregisterChatShortcut();
    globalShortcut.unregisterAll();
    childProcessRegistry.killAll();
    teardownIPC();
    identityVerificationService = null;
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
    if (updateEngine) {
      try {
        updateEngine.shutdown();
      } catch (error) {
        mainLogger.error('[UPDATE] Cleanup failed', { error: error.message });
      } finally {
        updateEngine = null;
      }
    }
    destroyTextToSpeech();
    await destroyAssistantInstance();
    eventBus?.removeAllListeners?.();
    if (chatWindow && !chatWindow.isDestroyed()) chatWindow.destroy();
    if (timerWidgetWindow && !timerWidgetWindow.isDestroyed()) timerWidgetWindow.destroy();
    if (plannerWindow && !plannerWindow.isDestroyed()) plannerWindow.destroy();
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

function openChatFromShortcut(shortcut = '') {
  createChatWindow();
  mainLogger.info('Chat shortcut opened chat', { shortcut });
  return { success: true };
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
        openChatFromShortcut(shortcut);
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
  runtimeConfig.updatePresentationHandler = async ({ command = '', operation = '', source = 'assistant' } = {}) => {
    const initializationError = ensureUpdateEngineInitialized();
    if (initializationError) return initializationError;
    return getUpdateEngine().assistantUpdateRequest(command || operation, source);
  };
  assistant = new Assistant(runtimeConfig, { eventBus });
  assistant.router.permissionValidator.setUserLevel(
    settingsService.getSettings().system.permissionLevel
  );

  textToSpeech = new TextToSpeech(runtimeConfig);
  textToSpeech.initialize()
    .catch(err => {
      mainLogger.warn('TTS initialization failed (non-fatal)', { error: err.message });
    });

  const voiceResources = createDesktopVoiceResources();
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
  if (!identityVerificationService) {
    const verifier = new WindowsIdentityVerifier();
    identityVerificationService = {
      verifyIdentity: () => verifier.verifyIdentity()
    };
  }
  const cloudTransfers = initializeCloudFileTransfers();
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

  showTimerWidget();
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
    'voiceOverlay:collapse',
    'update:executeAction',
    'update:install',
    'update:selfUpdate'
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
    if (String(envelope.payload?.kind || '').toLowerCase() === 'timer') showTimerWidget();
    presentScheduleInDynamicIsland(envelope.payload);
    sendPlannerEntries('calendar');
  });
  eventBus.subscribe(EVENTS.SCHEDULE_CHANGED, envelope => {
    sendPlannerEntries('calendar');
    broadcastScheduleSync(envelope.payload);
  });
  eventBus.subscribe(EVENTS.COMMAND_EXECUTED, envelope => handleTimerWidgetCommand(envelope.payload));
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
  ensureUpdateEngineInitialized();
  showTimerWidget();
  if (!app.isPackaged) {
    createChatWindow();
  }
  await validateUpdateRecoveryStartup();
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
}).catch(error => handleStartupFailureWithRecovery(error));

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
