const { VersionCheckConfiguration } = require('./version');
const { DownloadConfiguration } = require('./download');
const { VerificationConfiguration } = require('./verification');
const { InstallationConfiguration } = require('./install');
const { SelfUpdateConfiguration } = require('./selfupdate');
const { RecoveryConfiguration } = require('./recovery');

const DEFAULT_UPDATE_CONFIGURATION = Object.freeze({
  enabled: true,
  checkOnStartup: false,
  automaticDownload: false,
  automaticInstall: false,
  allowPrerelease: false,
  channel: 'stable',
  retryCount: 3,
  timeoutMs: 30000,
  loggingEnabled: true,
  diagnosticsEnabled: true,
  futureProvider: null,
  presentation: Object.freeze({
    preferredView: 'overview',
    expandedSections: ['version', 'download', 'releaseNotes'],
    notifyAboutUpdates: true,
    showDynamicIsland: true,
    showNotifications: true,
    assistantUpdates: true,
    voiceUpdates: true,
    reducedMotion: false,
    highContrast: false,
    windowState: Object.freeze({
      width: 960,
      height: 720,
      maximized: false
    })
  }),
  versionCheck: new VersionCheckConfiguration().toJSON(),
  download: new DownloadConfiguration().toJSON(),
  verification: new VerificationConfiguration().toJSON(),
  installation: new InstallationConfiguration().toJSON(),
  selfUpdate: new SelfUpdateConfiguration().toJSON(),
  recovery: new RecoveryConfiguration().toJSON()
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clampInteger(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function normalizeChannel(value, fallback = 'stable') {
  const channel = String(value || fallback).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  return channel || fallback;
}

function normalizeFutureProvider(value) {
  const provider = value === null || value === undefined ? null : String(value).trim();
  if (!provider) return null;
  return provider.replace(/[^a-z0-9._:-]/gi, '').slice(0, 80) || null;
}

function normalizeStringArray(value, fallback = []) {
  const source = Array.isArray(value) ? value : fallback;
  return source
    .map(item => String(item || '').trim().replace(/[^a-z0-9._:-]/gi, ''))
    .filter(Boolean)
    .slice(0, 20);
}

function normalizePresentation(value = {}) {
  const source = isPlainObject(value) ? value : {};
  const defaults = DEFAULT_UPDATE_CONFIGURATION.presentation;
  const windowSource = isPlainObject(source.windowState) ? source.windowState : {};
  return Object.freeze({
    preferredView: String(source.preferredView || defaults.preferredView).trim().replace(/[^a-z0-9._:-]/gi, '') || defaults.preferredView,
    expandedSections: normalizeStringArray(source.expandedSections, defaults.expandedSections),
    notifyAboutUpdates: source.notifyAboutUpdates !== false,
    showDynamicIsland: source.showDynamicIsland !== false,
    showNotifications: source.showNotifications !== false,
    assistantUpdates: source.assistantUpdates !== false,
    voiceUpdates: source.voiceUpdates !== false,
    reducedMotion: source.reducedMotion === true,
    highContrast: source.highContrast === true,
    windowState: Object.freeze({
      width: clampInteger(windowSource.width, 420, 2400, defaults.windowState.width),
      height: clampInteger(windowSource.height, 420, 1800, defaults.windowState.height),
      maximized: windowSource.maximized === true
    })
  });
}

class UpdateConfiguration {
  constructor(input = {}) {
    const source = isPlainObject(input) ? input : {};
    this.enabled = source.enabled !== false;
    this.checkOnStartup = source.checkOnStartup === true;
    this.automaticDownload = source.automaticDownload === true;
    this.automaticInstall = source.automaticInstall === true;
    this.allowPrerelease = source.allowPrerelease === true;
    this.channel = normalizeChannel(source.channel, DEFAULT_UPDATE_CONFIGURATION.channel);
    this.retryCount = clampInteger(source.retryCount, 0, 10, DEFAULT_UPDATE_CONFIGURATION.retryCount);
    this.timeoutMs = clampInteger(source.timeoutMs ?? source.timeout, 1000, 300000, DEFAULT_UPDATE_CONFIGURATION.timeoutMs);
    this.loggingEnabled = source.loggingEnabled !== false;
    this.diagnosticsEnabled = source.diagnosticsEnabled !== false;
    this.futureProvider = normalizeFutureProvider(source.futureProvider);
    this.presentation = normalizePresentation({
      ...DEFAULT_UPDATE_CONFIGURATION.presentation,
      ...(isPlainObject(source.presentation) ? source.presentation : {})
    });
    this.versionCheck = new VersionCheckConfiguration({
      ...DEFAULT_UPDATE_CONFIGURATION.versionCheck,
      ...(isPlainObject(source.versionCheck) ? source.versionCheck : {}),
      channel: source.versionCheck?.channel || source.channel || DEFAULT_UPDATE_CONFIGURATION.channel,
      loggingEnabled: source.versionCheck?.loggingEnabled ?? source.loggingEnabled,
      diagnosticsEnabled: source.versionCheck?.diagnosticsEnabled ?? source.diagnosticsEnabled
    });
    this.download = new DownloadConfiguration({
      ...DEFAULT_UPDATE_CONFIGURATION.download,
      ...(isPlainObject(source.download) ? source.download : {}),
      loggingEnabled: source.download?.loggingEnabled ?? source.loggingEnabled,
      diagnosticsEnabled: source.download?.diagnosticsEnabled ?? source.diagnosticsEnabled
    });
    this.verification = new VerificationConfiguration({
      ...DEFAULT_UPDATE_CONFIGURATION.verification,
      ...(isPlainObject(source.verification) ? source.verification : {}),
      loggingEnabled: source.verification?.loggingEnabled ?? source.loggingEnabled,
      diagnosticsEnabled: source.verification?.diagnosticsEnabled ?? source.diagnosticsEnabled
    });
    this.installation = new InstallationConfiguration({
      ...DEFAULT_UPDATE_CONFIGURATION.installation,
      ...(isPlainObject(source.installation) ? source.installation : {}),
      loggingEnabled: source.installation?.loggingEnabled ?? source.loggingEnabled,
      diagnosticsEnabled: source.installation?.diagnosticsEnabled ?? source.diagnosticsEnabled
    });
    this.selfUpdate = new SelfUpdateConfiguration({
      ...DEFAULT_UPDATE_CONFIGURATION.selfUpdate,
      ...(isPlainObject(source.selfUpdate) ? source.selfUpdate : {}),
      loggingEnabled: source.selfUpdate?.loggingEnabled ?? source.loggingEnabled,
      diagnosticsEnabled: source.selfUpdate?.diagnosticsEnabled ?? source.diagnosticsEnabled
    });
    this.recovery = new RecoveryConfiguration({
      ...DEFAULT_UPDATE_CONFIGURATION.recovery,
      ...(isPlainObject(source.recovery) ? source.recovery : {}),
      loggingEnabled: source.recovery?.loggingEnabled ?? source.loggingEnabled,
      diagnosticsEnabled: source.recovery?.diagnosticsEnabled ?? source.diagnosticsEnabled
    });
    Object.freeze(this);
  }

  toJSON() {
    return {
      enabled: this.enabled,
      checkOnStartup: this.checkOnStartup,
      automaticDownload: this.automaticDownload,
      automaticInstall: this.automaticInstall,
      allowPrerelease: this.allowPrerelease,
      channel: this.channel,
      retryCount: this.retryCount,
      timeoutMs: this.timeoutMs,
      loggingEnabled: this.loggingEnabled,
      diagnosticsEnabled: this.diagnosticsEnabled,
      futureProvider: this.futureProvider,
      presentation: this.presentation,
      versionCheck: this.versionCheck.toJSON(),
      download: this.download.toJSON(),
      verification: this.verification.toJSON(),
      installation: this.installation.toJSON(),
      selfUpdate: this.selfUpdate.toJSON(),
      recovery: this.recovery.toJSON()
    };
  }

  merge(input = {}) {
    return new UpdateConfiguration({ ...this.toJSON(), ...(isPlainObject(input) ? input : {}) });
  }

  static defaults() {
    return new UpdateConfiguration(DEFAULT_UPDATE_CONFIGURATION);
  }
}

module.exports = {
  DEFAULT_UPDATE_CONFIGURATION,
  UpdateConfiguration
};
