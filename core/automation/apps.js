const fs = require('fs');
const path = require('path');
const Logger = require('../assistant/Data').Logger;
const Normalizer = require('../assistant/Data').Normalizer;
const { execFile: execFileAsync } = require('child_process');
const execFileP = require('util').promisify(execFileAsync);
const launcher = require('./common/launcher');
const WindowsSessionController = require('./common/windows-session');
const { scoreName } = require('./common/search-scoring');

const PS_EXEC_OPTS = { encoding: 'utf8', windowsHide: true };

function asyncSleep(ms) {
  const duration = Math.max(0, Number(ms) || 0);
  if (duration === 0) return Promise.resolve();
  return new Promise(resolve => setTimeout(resolve, duration));
}

async function execPs(commandText, timeoutMs = POWERSHELL_TIMEOUT_MS) {
  const result = await execFileP(
    'powershell.exe',
    ['-NoProfile', '-Command', commandText],
    { ...PS_EXEC_OPTS, timeout: timeoutMs }
  );
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    return typeof result.stdout === 'string' ? result.stdout : '';
  }
  return String(result || '');
}

function envDirectory(name, fallback = '') {
  return String(process.env[name] || fallback || '').trim();
}

function windowsRootPath(...segments) {
  return path.join(envDirectory('SystemRoot', 'C:\\Windows'), ...segments);
}

function programFilePath(envName, ...segments) {
  const root = envDirectory(envName);
  return root ? path.join(root, ...segments) : null;
}

function localAppDataPath(...segments) {
  const root = envDirectory('LOCALAPPDATA');
  return root ? path.join(root, ...segments) : null;
}

function appPathCandidates(...candidates) {
  return candidates.filter(Boolean);
}

function browserExecutablePaths(browserName) {
  if (browserName === 'chrome') {
    return appPathCandidates(
      programFilePath('ProgramFiles', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      programFilePath('ProgramFiles(x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      localAppDataPath('Google', 'Chrome', 'Application', 'chrome.exe')
    );
  }
  if (browserName === 'edge') {
    return appPathCandidates(
      programFilePath('ProgramFiles', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      programFilePath('ProgramFiles(x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      localAppDataPath('Microsoft', 'Edge', 'Application', 'msedge.exe')
    );
  }
  if (browserName === 'firefox') {
    return appPathCandidates(
      programFilePath('ProgramFiles', 'Mozilla Firefox', 'firefox.exe'),
      programFilePath('ProgramFiles(x86)', 'Mozilla Firefox', 'firefox.exe'),
      localAppDataPath('Mozilla Firefox', 'firefox.exe')
    );
  }
  return [];
}

const KNOWN_APPS = {
  'code': {
    path: null,
    cmd: 'code',
    processName: 'Code',
    newWindowArgs: ['--new-window'],
    newTabShortcut: '^n',
    newWindowVerification: { initialDelayMs: 600, attempts: 2, retryDelayMs: 350 }
  },
  'chrome': {
    paths: browserExecutablePaths('chrome'),
    cmd: 'chrome',
    newWindowArgs: ['--new-window'],
    closeStrategy: 'window',
    windowQuery: 'chrome',
    preferredTitleTokens: ['chrome', 'new tab', '- google chrome'],
    preferredProcessNames: ['chrome', 'ApplicationFrameHost']
  },
  'msedge': { paths: browserExecutablePaths('edge'), cmd: 'msedge', newWindowArgs: ['--new-window'] },
  'edge': { paths: browserExecutablePaths('edge'), cmd: 'msedge', newWindowArgs: ['--new-window'] },
  'firefox': { paths: browserExecutablePaths('firefox'), cmd: 'firefox', newWindowArgs: ['--new-window'] },
  'brave': { cmd: 'brave', newWindowArgs: ['--new-window'] },
  'notepad': { paths: [windowsRootPath('System32', 'notepad.exe')], cmd: 'notepad', newTabShortcut: '^n' },
  'calc': { paths: [windowsRootPath('System32', 'calc.exe')], cmd: 'calc' },
  'mspaint': { paths: [windowsRootPath('System32', 'mspaint.exe')], cmd: 'mspaint' },
  'cmd': { paths: [windowsRootPath('System32', 'cmd.exe')], cmd: 'cmd' },
  'powershell': { paths: [windowsRootPath('System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')], cmd: 'powershell' },
  'explorer': { paths: [windowsRootPath('explorer.exe')], cmd: 'explorer', newWindowArgs: ['/n'] },
  'taskmgr': { paths: [windowsRootPath('System32', 'Taskmgr.exe')], cmd: 'taskmgr' },
  'devmgmt.msc': { paths: [windowsRootPath('System32', 'mmc.exe')], cmd: 'mmc', args: ['devmgmt.msc'] },
  'diskmgmt.msc': { paths: [windowsRootPath('System32', 'mmc.exe')], cmd: 'mmc', args: ['diskmgmt.msc'] },
  'services.msc': { paths: [windowsRootPath('System32', 'mmc.exe')], cmd: 'mmc', args: ['services.msc'] },
  'control': { paths: [windowsRootPath('System32', 'control.exe')], cmd: 'control' },
  'snippingtool': { paths: [windowsRootPath('System32', 'SnippingTool.exe')], cmd: 'SnippingTool' },
  'winword': { cmd: 'winword', newWindowArgs: ['/n'] },
  'excel': { cmd: 'excel', newWindowArgs: ['/x'] },
  'powerpoint': { cmd: 'powerpnt', processName: 'POWERPNT', newWindowArgs: ['/n'] },
  'outlook': { cmd: 'outlook' },
  'spotify': { cmd: 'spotify' },
  'discord': { cmd: 'discord', processName: 'Discord' },
  'slack': { cmd: 'slack' },
  'zoom': { cmd: 'zoom' },
  'teams': { cmd: 'teams', processName: 'Teams' },
  'apple music': { processName: 'AppleMusic' },
  'apple tv': { processName: 'AppleTV' },
  'calendar': { processName: 'HxCalendarAppImm' },
  'clock': { processName: 'WindowsAlarms' },
  'youtube': {
    closeStrategy: 'window',
    windowQuery: 'youtube',
    preferredProcessNames: ['chrome', 'msedge', 'firefox'],
    preferredTitleTokens: ['youtube']
  },
  'instagram': {
    closeStrategy: 'window',
    windowQuery: 'instagram',
    preferredTitleTokens: ['instagram'],
    preferredProcessNames: ['Instagram', 'ApplicationFrameHost', 'chrome', 'msedge', 'firefox']
  },
  'antigravity': { processName: 'Antigravity IDE' }
};

const SPECIAL_LAUNCHERS = {
  'ms-settings': { target: 'ms-settings:' },
  'ms-settings:': { target: 'ms-settings:' },
  'windows settings': { target: 'ms-settings:' },
  'system settings': { target: 'ms-settings:' },
  'recycle bin': { target: windowsRootPath('explorer.exe'), args: ['shell:RecycleBinFolder'] },
  'microsoft store': { target: 'ms-windows-store:' },
  'soundrecorder': { target: 'ms-soundrecorder:' },
  'camera': { target: 'microsoft.windows.camera:' },
  'ms-settings:windowsupdate': { target: 'ms-settings:windowsupdate' },
  'ms-settings:display': { target: 'ms-settings:display' },
  'ms-settings:sound': { target: 'ms-settings:sound' },
  'ms-settings:bluetooth': { target: 'ms-settings:bluetooth' },
  'ms-settings:network-wifi': { target: 'ms-settings:network-wifi' },
  'ms-settings:network': { target: 'ms-settings:network' },
  'ms-settings:storagesense': { target: 'ms-settings:storagesense' },
  'ms-settings:privacy': { target: 'ms-settings:privacy' },
  'ms-settings:easeofaccess': { target: 'ms-settings:easeofaccess' },
  'ms-settings:keyboard': { target: 'ms-settings:keyboard' },
  'ms-settings:mousetouchpad': { target: 'ms-settings:mousetouchpad' },
  'ms-settings:printers': { target: 'ms-settings:printers' },
  'ms-settings:powersleep': { target: 'ms-settings:powersleep' },
  'windowsdefender:': { target: 'windowsdefender:' },
  'windowsdefender://network': { target: 'windowsdefender://network' },
  'photos': { target: 'ms-photos:' },
  'google chat': { target: 'https://chat.google.com', webFallback: true },
  'youtube': { target: 'https://www.youtube.com', webFallback: true }
};

const BROWSER_APP_NAMES = new Set(['chrome', 'msedge', 'edge', 'firefox']);
const COMMAND_FIRST_APPS = new Set(['chrome', 'msedge', 'edge', 'firefox']);
const APP_NAME_MAX_LENGTH = 120;
const POWERSHELL_TIMEOUT_MS = 10000;
const START_APPS_TIMEOUT_MS = 6500;
const COMMAND_EXISTS_TIMEOUT_MS = 2500;
const PROCESS_DETAILS_TIMEOUT_MS = 2500;
const START_APPS_CACHE_TTL_MS = 60_000;
const START_APPS_FAILURE_TTL_MS = 15_000;
const COMMAND_EXISTS_CACHE_TTL_MS = 60_000;
const COMMAND_EXISTS_FAILURE_TTL_MS = 10_000;
const PROCESS_DETAILS_CACHE_TTL_MS = 2000;

const APP_ALIASES = new Map([
  ['google chrome', 'chrome'],
  ['chrome browser', 'chrome'],
  ['microsoft edge', 'edge'],
  ['edge browser', 'edge'],
  ['mozilla firefox', 'firefox'],
  ['firefox browser', 'firefox'],
  ['brave browser', 'brave'],
  ['visual studio code', 'code'],
  ['vs code', 'code'],
  ['vscode', 'code'],
  ['calculator', 'calc'],
  ['paint', 'mspaint'],

  ['sound recorder', 'soundrecorder'],
  ['device manager', 'devmgmt.msc'],
  ['disk management', 'diskmgmt.msc'],
  ['services', 'services.msc'],
  ['instagram', 'instagram'],
  ['instagram app', 'instagram'],
  ['instgram', 'instagram'],
  ['instagran', 'instagram'],
  ['insta', 'instagram']
]);

const PROTECTED_HOST_PROCESSES = new Set([
  'applicationframehost',
  'dwm',
  'explorer',
  'shellexperiencehost',
  'startmenuexperiencehost'
]);

function escapePowerShell(value) {
  return String(value ?? '').replace(/'/g, "''");
}

function parseJsonObjectArray(output) {
  const parsed = JSON.parse(output || '[]');
  return Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
}

class AppController {
  constructor(config) {
    this.config = config || {};
    this.logger = new Logger(config?.logging || { level: 'info' });
    this.windowSession = new WindowsSessionController(config);
    this._startAppsCache = null;
    this._startAppsCacheExpiresAt = 0;
    this._commandExistsCache = new Map();
    this._processDetailsCache = null;
    this._processDetailsCacheExpiresAt = 0;
  }

  async open(appName, options = {}) {
    const validation = this._validateAppName(appName);
    if (!validation.valid) return this._failure(validation.error, 'app.open.validation');

    const { displayName, name } = validation;
    const app = KNOWN_APPS[name];
    const forceNewWindow = Boolean(options.forceNewWindow);
    const requestedOperation = forceNewWindow
      ? 'open-new-window'
      : (options.requestedOperation || 'open-or-focus');
    const beforeWindowCount = forceNewWindow ? await this._countAppWindows(name) : null;
    const launchArgs = forceNewWindow
      ? (app?.newWindowArgs || app?.args || [])
      : (app?.args || []);

try {
      if (options.webRequested === true && this._getWebFallbackTarget(name, options)) {
        return this._buildWebFallbackClarification(name, displayName, options);
      }

      if (!options.forceNewWindow && !options.skipAlreadyOpenCheck) {
        const existingTarget = await this.findVisibleApp(name, { allowWindowFallback: false });
        if (existingTarget) {
          const focused = await this._focusExistingApp(name, existingTarget);
          if (focused) {
            focused.data.app = displayName;
            focused.data.appId = name;
            focused.data.requestedOperation = requestedOperation;
            focused.data.forceNewWindow = false;
            return focused;
          }
        }
      }

      const executablePath = this._resolveExecutablePath(app);
      if (executablePath) {
        if (fs.existsSync(executablePath)) {
          await this._launchTarget(executablePath, launchArgs);
          return await this._completeAppOpen(name, {
            success: true,
            data: { app: name, launchMethod: 'executable', target: executablePath }
          }, { forceNewWindow, requestedOperation, beforeWindowCount, launchArgs, displayName });
        }
      }

      const specialLaunch = this._isWebFallbackLauncher(name)
        ? { success: false }
        : await this._launchSpecialApp(name);
      if (specialLaunch.success) {
        return await this._completeAppOpen(name, specialLaunch, {
          forceNewWindow,
          requestedOperation,
          beforeWindowCount,
          launchArgs: [],
          displayName
        });
      }

      const commandSupportsNewWindow = forceNewWindow && Array.isArray(app?.newWindowArgs) && app.newWindowArgs.length > 0;
      if ((COMMAND_FIRST_APPS.has(name) || commandSupportsNewWindow) && app?.cmd && await this._commandExists(app.cmd)) {
        await this._launchTarget(app.cmd, launchArgs);
        return await this._completeAppOpen(name, {
          success: true,
          data: { app: name, launchMethod: 'command' }
        }, { forceNewWindow, requestedOperation, beforeWindowCount, launchArgs, displayName });
      }

      const startApp = await this._resolveStartApp(name);
      if (startApp) {
        await this._launchStartApp(startApp);
        return await this._completeAppOpen(name, {
          success: true,
          data: {
            app: name,
            resolvedName: startApp.name,
            appId: startApp.appId,
            launchMethod: 'start-menu'
          }
        }, { forceNewWindow, requestedOperation, beforeWindowCount, launchArgs: [], displayName });
      }

      if (app?.cmd && await this._commandExists(app.cmd)) {
        await this._launchTarget(app.cmd, launchArgs);
        return await this._completeAppOpen(name, {
          success: true,
          data: { app: name, launchMethod: 'command' }
        }, { forceNewWindow, requestedOperation, beforeWindowCount, launchArgs, displayName });
      }

      return this._buildWebFallbackClarification(name, displayName, options);
    } catch (err) {
      this.logger.error(`Failed to open app: ${name}`, err);
      return this._failure(`Could not find or open: ${displayName}`, 'app.open.failed', {
        app: displayName,
        appId: name,
        reason: err.message
      });
    }
  }

  _buildWebFallbackClarification(name, displayName, options = {}) {
    const webInfo = this._getWebFallbackTarget(name, options);
    if (webInfo && options.webRequested === true) {
      return {
        success: false,
        error: `Use web fallback for: ${displayName}`,
        data: {
          app: displayName,
          appId: name,
          launchMethod: 'web-fallback-deferred',
          webFallbackUrl: webInfo.url,
          webFallbackBrowser: webInfo.browser,
          ...(webInfo.searchQuery ? { webSearchFallbackQuery: webInfo.searchQuery } : {}),
          ...(webInfo.title ? { webFallbackTitle: webInfo.title } : {})
        }
      };
    }

    if (webInfo) {
      const confirmEntities = {
        webRequested: true,
        appName: name,
        webFallbackBrowser: webInfo.browser,
        ...(webInfo.url ? { webFallbackUrl: webInfo.url } : {}),
        ...(options.allowWebSearchFallback && webInfo.searchQuery
          ? {
              allowWebSearchFallback: true,
              webSearchFallbackQuery: webInfo.searchQuery
            }
          : {})
      };
      return {
        success: false,
        needsClarification: true,
        error: `I couldn't find "${displayName}" installed on this computer. Would you like me to open it on the web instead?`,
        code: 'app.open.not-found',
        data: {
          clarificationType: 'app.open.webFallback',
          app: displayName,
          appId: name,
          matchCount: 0,
          webFallbackUrl: webInfo.url || null,
          webFallbackBrowser: webInfo.browser,
          ...(options.allowWebSearchFallback && webInfo.searchQuery
            ? { webSearchFallbackQuery: webInfo.searchQuery }
            : {}),
          confirmEntities
        }
      };
    }

    return { success: false, error: `Could not find app: ${displayName}` };
  }

  async _completeAppOpen(name, result, context = {}) {
    const data = {
      ...(result.data || {}),
      app: context.displayName || result.data?.app || name,
      appId: name,
      requestedOperation: context.requestedOperation || 'open-or-focus',
      forceNewWindow: Boolean(context.forceNewWindow),
      launchArguments: Array.isArray(context.launchArgs) ? context.launchArgs : []
    };
    if (!context.forceNewWindow) {
      return { ...result, data };
    }

    const beforeWindowCount = Number.isFinite(context.beforeWindowCount)
      ? context.beforeWindowCount
      : null;
    if (beforeWindowCount === null) {
      return {
        ...result,
        data: {
          ...data,
          beforeWindowCount: null,
          afterWindowCount: null,
          newWindowVerified: null,
          verificationMethod: 'top-level-window-count-unavailable'
        }
      };
    }

    const verificationConfig = KNOWN_APPS[name]?.newWindowVerification || {};
    if (Number(verificationConfig.initialDelayMs) > 0) {
      await this._sleep(verificationConfig.initialDelayMs);
    }

    let afterWindowCount = await this._countAppWindows(name);
    const attempts = Math.max(1, Number(verificationConfig.attempts) || 1);
    for (let attempt = 1; attempt < attempts && afterWindowCount !== null && afterWindowCount <= beforeWindowCount; attempt += 1) {
      await this._sleep(verificationConfig.retryDelayMs || 250);
      afterWindowCount = await this._countAppWindows(name);
    }
    const observationAvailable = afterWindowCount !== null;

    return {
      ...result,
      data: {
        ...data,
        beforeWindowCount,
        afterWindowCount,
        newWindowVerified: observationAvailable ? afterWindowCount > beforeWindowCount : null,
        verificationMethod: observationAvailable
          ? 'top-level-window-count'
          : 'top-level-window-count-unavailable'
      }
    };
  }

  async _countAppWindows(appName) {
    const processNames = this._resolveProcessCandidates(appName);
    if (typeof this.windowSession.listProcessWindows === 'function') {
      const windows = this.windowSession.listProcessWindows(processNames);
      return this.windowSession.lastProcessWindowEnumerationSucceeded === false
        ? null
        : windows.length;
    }
    return this._visibleCloseTargets(
      this._filterCloseTargets(appName, await this._findRunningProcesses(appName, processNames))
    ).length;
  }

  async openNewTab(appName) {
    const validation = this._validateAppName(appName);
    if (!validation.valid) return this._failure(validation.error, 'app.newTab.validation');

    const { displayName, name } = validation;
    const app = KNOWN_APPS[name];
    if (!app?.newTabShortcut) {
      return { success: false, error: `${displayName} does not have a supported new-tab command` };
    }

    let target = await this.findVisibleApp(name, { allowWindowFallback: false });
    let openedApp = false;
    if (!target) {
      const openResult = await this.open(displayName);
      if (!openResult.success) return openResult;
      target = await this.waitForVisibleApp(name, { attempts: 3, intervalMs: 120 });
      openedApp = true;
    }
    if (!target) {
      return { success: false, error: `Could not verify an open ${displayName} window for the new tab` };
    }

    const title = String(target.MainWindowTitle || app.windowQuery || displayName).trim();
    const controlled = this.windowSession.sendKeys(title, app.newTabShortcut, {
      ...this._windowMatchOptions(name, app),
      preferredProcessNames: this._resolveProcessCandidates(name)
    });
    if (!controlled.success) return controlled;

    return {
      success: true,
      data: {
        app: displayName,
        appId: name,
        action: 'new-tab',
        requestedOperation: 'open-new-tab',
        shortcut: app.newTabShortcut,
        openedApp,
        matchedWindow: controlled.data?.matchedWindow || title,
        processName: controlled.data?.processName || target.ProcessName || '',
        verified: true
      }
    };
  }

  async close(appName, options = {}) {
    const validation = this._validateAppName(appName);
    if (!validation.valid) return this._failure(validation.error, 'app.close.validation');

    const { name } = validation;
    const app = KNOWN_APPS[name];
    try {
      const selectedClose = await this._closeSelectedProcess(name, options);
      if (selectedClose) {
        return selectedClose;
      }

      const browserClose = this._isBrowserAppName(name);
      if (app?.closeStrategy === 'window' && !browserClose) {
        const windowClose = await this._closeAppWindow(name, app);
        if (windowClose.success) {
          return windowClose;
        }
      }

      const processNames = this._resolveProcessCandidates(name);
      let runningProcesses = this._filterCloseTargets(
        name,
        await this._findRunningProcesses(name, processNames)
      );

      if (runningProcesses.length > 0) {
        const requestedCloseCount = runningProcesses.length;
        const targetProcessIds = runningProcesses.map(process => Number(process?.Id)).filter(id => Number.isFinite(id) && id > 0);
        await this._closeProcessesGracefully(runningProcesses);
        const gracefulWait = await this._waitForProcessesGone(name, processNames, targetProcessIds, {
          attempts: browserClose ? 5 : 6,
          intervalMs: browserClose ? 180 : 160
        });
        runningProcesses = gracefulWait.remaining;

        if (browserClose) {
          if (runningProcesses.length > 0 && await this.waitForAppClosed(name, {
            attempts: 2,
            intervalMs: 180
          })) {
            runningProcesses = [];
          }
          if (runningProcesses.length === 0) {
            return {
              success: true,
              data: {
                app: name,
                closedCount: requestedCloseCount,
                closeMethod: 'window',
                verified: true
              }
            };
          }
          return { success: false, error: `Could not close every ${name} browser window` };
        }

        if (!browserClose && runningProcesses.length > 0) {
          await this._forceTerminateProcesses(runningProcesses);
          const forcedWait = await this._waitForProcessesGone(name, processNames, targetProcessIds, {
            attempts: 5,
            intervalMs: 140
          });
          runningProcesses = forcedWait.remaining;
        }

        if (runningProcesses.length === 0) {
          return {
            success: true,
            data: {
              app: name,
              closedCount: requestedCloseCount,
              closeMethod: 'process',
              verified: true
            }
          };
        }
      }

      const windowClose = await this._closeAppWindow(name, app, {
        requireBrowserIdentity: browserClose
      });
      if (windowClose.success) {
        return windowClose;
      }
      if (/browser tab/i.test(String(windowClose.error || ''))) {
        return windowClose;
      }

      return { success: false, error: `Could not close: ${name}` };
    } catch (err) {
      return { success: false, error: `Could not close: ${name}` };
    }
  }

  async _closeAppWindow(name, app = KNOWN_APPS[name], options = {}) {
    const windowQuery = app?.windowQuery || name;
    const matchOptions = this._windowMatchOptions(name, app);
    const matchedWindow = this.windowSession.findWindow(windowQuery, {
      ...matchOptions,
      requireTitleTokenMatch: Boolean(options.requireBrowserIdentity) || matchOptions.requireTitleTokenMatch
    });

    if (!app && this._isSharedBrowserProcess(matchedWindow?.processName)) {
      return {
        success: false,
        error: `${name} looks like a browser tab, so I will not close the whole browser window from app close. Close the browser tab instead.`
      };
    }

    const closeResult = this.windowSession.closeWindow(windowQuery, {
      ...matchOptions,
      requireTitleTokenMatch: Boolean(options.requireBrowserIdentity) || matchOptions.requireTitleTokenMatch
    });

    if (!closeResult.success) {
      return { success: false, error: closeResult.error };
    }

    this._invalidateProcessDetailsCache();
    const verifiedClosed = await this.waitForAppClosed(name, {
      attempts: Number(options.verifyAttempts) || 4,
      intervalMs: Number(options.verifyIntervalMs) || 160,
      allowWindowFallback: options.allowWindowFallback === true
    });
    if (!verifiedClosed) {
      return {
        success: false,
        error: `${name} still appears to be open`,
        data: {
          app: name,
          closeMethod: 'window',
          matchedWindow: closeResult.data?.matchedWindow || null,
          processName: closeResult.data?.processName || null,
          verified: false
        }
      };
    }

    return {
      success: true,
      data: {
        app: name,
        closeMethod: 'window',
        matchedWindow: closeResult.data?.matchedWindow || null,
        processName: closeResult.data?.processName || null,
        verified: true
      }
    };
  }

  _resolveExecutablePath(app) {
    const paths = [
      ...(Array.isArray(app?.paths) ? app.paths : []),
      app?.path
    ].filter(Boolean);

    for (const candidate of paths) {
      try {
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      } catch (error) {
        continue;
      }
    }

    return null;
  }

async _getStartApps() {
    const now = Date.now();
    if (this._startAppsCache && now < this._startAppsCacheExpiresAt) {
      return this._startAppsCache;
    }

    try {
      const stdout = await execPs(
        'Get-StartApps | Select-Object Name,AppID | ConvertTo-Json -Compress',
        START_APPS_TIMEOUT_MS
      );

      const apps = parseJsonObjectArray(stdout);
      this._startAppsCache = this._normalizeStartAppEntries(apps);
      this._startAppsCacheExpiresAt = now + START_APPS_CACHE_TTL_MS;
      return this._startAppsCache;
    } catch (err) {
      const fallbackEntries = await this._discoverStartMenuShortcuts();
      if (fallbackEntries.length > 0) {
        this.logger.warn('Start menu app lookup failed; using shortcut scan fallback', err.message);
        this._startAppsCache = fallbackEntries;
        this._startAppsCacheExpiresAt = now + START_APPS_CACHE_TTL_MS;
        return this._startAppsCache;
      }
      this.logger.warn('Failed to load Start menu apps', err.message);
      this._startAppsCache = [];
      this._startAppsCacheExpiresAt = now + START_APPS_FAILURE_TTL_MS;
      return this._startAppsCache;
    }
  }

  _normalizeStartAppEntries(apps) {
    const entries = [];
    for (const candidate of (Array.isArray(apps) ? apps : [])) {
      const name = String(candidate?.Name || '').trim();
      const appId = String(candidate?.AppID || candidate?.appId || '').trim();
      if (!name || !appId) {
        continue;
      }
      entries.push({ name, appId, normalizedName: Normalizer.normalizeText(name) });
    }
    return entries;
  }

  async _discoverStartMenuShortcuts() {
    try {
      const stdout = await execPs(`
$dirs = @(
  [Environment]::GetFolderPath('Programs'),
  [Environment]::GetFolderPath('CommonPrograms')
) | Where-Object { $_ -and (Test-Path $_) }
$shell = $null
$results = @()
$previousDir = $null
foreach ($dir in $dirs) {
  if ($dir -eq $previousDir) { continue }
  $previousDir = $dir
  Get-ChildItem -Path $dir -Filter '*.lnk' -Recurse -Depth 1 -ErrorAction SilentlyContinue | ForEach-Object {
    if ($results.Count -ge 500) { return }
    if (-not $shell) { $shell = New-Object -ComObject WScript.Shell }
    $target = ''
    try { $target = $shell.CreateShortcut($_.FullName).TargetPath } catch { $target = '' }
    if (-not $target -or -not (Test-Path $target)) { return }
    $results += [pscustomobject]@{ Name = $_.BaseName; AppID = $target }
  }
}
$appPaths = @(
  'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths',
  'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths',
  'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths'
)
foreach ($root in $appPaths) {
  if (-not (Test-Path $root)) { continue }
  Get-ChildItem -Path $root -ErrorAction SilentlyContinue | ForEach-Object {
    if ($results.Count -ge 500) { return }
    $target = ''
    try { $target = (Get-ItemProperty -Path $_.PSPath -ErrorAction SilentlyContinue).'(default)' } catch { $target = '' }
    if (-not $target -or -not (Test-Path $target)) { return }
    $name = $_.PSChildName -replace '\\.exe$', ''
    $results += [pscustomobject]@{ Name = $name; AppID = $target }
  }
}
$results | ConvertTo-Json -Compress
`, START_APPS_TIMEOUT_MS);

      const parsed = parseJsonObjectArray(stdout);
      const seen = new Set();
      const entries = [];
      for (const candidate of parsed) {
        const name = String(candidate?.Name || '').trim();
        const appId = String(candidate?.AppID || '').trim();
        if (!name || !appId || seen.has(appId.toLowerCase())) {
          continue;
        }
        seen.add(appId.toLowerCase());
        entries.push({ name, appId, normalizedName: Normalizer.normalizeText(name) });
      }
      return entries;
    } catch (err) {
      this.logger.warn('Start menu shortcut fallback scan failed', err.message);
      return [];
    }
  }

  async _resolveStartApp(name) {
    const normalizedName = Normalizer.normalizeText(name);
    if (!normalizedName) return null;

    const apps = await this._getStartApps();
    const exact = apps.find(candidate => candidate.normalizedName === normalizedName);
    if (exact) return exact;

    const scored = apps
      .map(candidate => ({
        candidate,
        score: this._scoreStartAppCandidate(normalizedName, candidate)
      }))
      .filter(item => item.score >= 75)
      .sort((left, right) => right.score - left.score);
    if (scored[0]) return scored[0].candidate;

    const closest = Normalizer.findClosestOption(
      normalizedName,
      apps.map(candidate => candidate.name),
      { minSimilarity: 0.58, maxDistance: 4 }
    );

    if (!closest) {
      return null;
    }

    return apps.find(candidate => candidate.normalizedName === closest.normalizedMatch) || null;
  }

  _scoreStartAppCandidate(normalizedName, candidate) {
    const target = String(normalizedName || '').trim();
    const candidateName = String(candidate?.normalizedName || '').trim();
    const appId = Normalizer.normalizeText(candidate?.appId || '');
    if (!target || !candidateName) return 0;
    if (candidateName === target) return 100;
    if (candidateName.startsWith(`${target} `)) return 92;
    if (candidateName.endsWith(` ${target}`)) return 88;

    const scored = scoreName(target, candidate?.name || candidateName);
    if (scored > 0) return scored;

    if (target.length >= 4 && appId.includes(target.replace(/\s+/g, ''))) return 75;
    return 0;
  }

  async _launchStartApp(startApp) {
    const appId = startApp.appId;
    if (!appId) {
      throw new Error('Missing Start menu app identifier');
    }
    if (!this._isSafeStartAppId(appId)) {
      throw new Error('Unsafe Start menu app identifier');
    }

    if (/^[A-Za-z]:\\/.test(appId) || /\\[^\\]+\.exe$/i.test(appId)) {
      if (!fs.existsSync(appId)) {
        throw new Error('Start menu executable target does not exist');
      }
      await this._launchTarget(appId);
      return;
    }

    await this._launchTarget(windowsRootPath('explorer.exe'), [`shell:AppsFolder\\${appId}`]);
  }

  _isSafeStartAppId(appId) {
    const value = String(appId || '').trim();
    if (!value || value.length > 500 || /[\x00-\x1f\x7f]/.test(value)) return false;
    if (/[;&|`]/.test(value)) return false;
    if (/^[A-Za-z]:\\/.test(value) || /\\[^\\]+\.exe$/i.test(value)) {
      return /^[A-Za-z]:\\[^<>:"|?*]+\.exe$/i.test(value);
    }
    return /^[\w\s.!\-\\{}]+$/.test(value);
  }

  async _launchSpecialApp(name) {
    if (/^ms-settings:/i.test(String(name || ''))) {
      await this._launchTarget(name);
      return {
        success: true,
        data: {
          app: name,
          launchMethod: 'settings-protocol',
          target: name
        }
      };
    }

    const launcher = SPECIAL_LAUNCHERS[name];
    if (!launcher) {
      return { success: false };
    }

    try {
      await this._launchTarget(launcher.target, launcher.args || []);
      return {
        success: true,
        data: {
          app: name,
          launchMethod: 'special',
          target: launcher.target
        }
      };
    } catch (err) {
      this.logger.error(`Failed to launch special app: ${name}`, err);
      return { success: false, error: `Could not open: ${name}` };
    }
  }

  _isWebFallbackLauncher(name) {
    return SPECIAL_LAUNCHERS[name]?.webFallback === true;
  }

_getWebFallbackTarget(name, options = {}) {
    const launcher = SPECIAL_LAUNCHERS[name];
    const url = String(
      options.webFallbackUrl ||
      (launcher?.target && /^https?:/i.test(String(launcher.target)) ? launcher.target : '') ||
      ''
    ).trim();
    if (!url) {
      return null;
    }
    return {
      url,
      browser: String(options.webFallbackBrowser || 'chrome').trim() || 'chrome',
      title: String(options.webFallbackTitle || '').trim() || null,
      searchQuery: String(options.webSearchFallbackQuery || '').trim() || null
    };
  }

  async _commandExists(command) {
    const safeCommand = String(command || '').trim();
    if (!safeCommand) {
      return false;
    }

    const cacheKey = safeCommand.toLowerCase();
    const now = Date.now();
    const cached = this._commandExistsCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.exists;
    }

    try {
      await execFileP('where.exe', [safeCommand], {
        encoding: 'utf8',
        timeout: COMMAND_EXISTS_TIMEOUT_MS,
        windowsHide: true
      });
      this._commandExistsCache.set(cacheKey, {
        exists: true,
        expiresAt: now + COMMAND_EXISTS_CACHE_TTL_MS
      });
      return true;
    } catch (err) {
      this._commandExistsCache.set(cacheKey, {
        exists: false,
        expiresAt: now + COMMAND_EXISTS_FAILURE_TTL_MS
      });
      return false;
    }
  }

  _resolveProcessCandidates(name) {
    name = this._normalizeAppName(name);
    const candidates = new Set();
    const app = KNOWN_APPS[name];

    if (app?.processName) {
      candidates.add(app.processName);
    }
    if (app?.cmd) {
      candidates.add(app.cmd);
    }
    if (app?.closeStrategy === 'window' && Array.isArray(app.preferredProcessNames)) {
      app.preferredProcessNames.forEach(processName => {
        if (String(processName || '').trim()) {
          candidates.add(processName);
        }
      });
    }
    candidates.add(name);

    return Array.from(candidates);
  }

  async _findRunningProcesses(name, processCandidates = []) {
    name = this._normalizeAppName(name);
    const processes = await this._getRunningProcessDetails();
    if (!Array.isArray(processes) || processes.length === 0) {
      return [];
    }

    const searchTerms = new Set(
      [name, ...processCandidates]
        .map(candidate => String(candidate || '').trim().toLowerCase())
        .filter(candidate => candidate && !['app', 'application'].includes(candidate))
    );

    const rankedMatches = processes.map(process => {
      const processName = String(process.ProcessName || '').toLowerCase();
      const windowTitle = String(process.MainWindowTitle || '').toLowerCase();
      let score = 0;

      Array.from(searchTerms).forEach(term => {
        if (processName === term) score += 160;
        else if (processName.startsWith(`${term}.`)) score += 135;
        else if (processName.includes(term) && term.length >= 4) score += 90;

        if (windowTitle === term) score += 120;
        else if (windowTitle.includes(term)) score += 70;
      });

      return { process, score };
    });

    return rankedMatches
      .filter(item => item.score >= 100)
      .sort((left, right) => right.score - left.score)
      .map(item => item.process);
  }

  _filterCloseTargets(name, processes) {
    if (this._isBrowserAppName(name)) {
      return processes.filter(process => {
        const windowTitle = String(process?.MainWindowTitle || '').trim().toLowerCase();
        const mainWindowHandle = Number(process?.MainWindowHandle || 0);
        const browserIdentity = name === 'firefox'
          ? 'firefox'
          : (name === 'edge' || name === 'msedge' ? 'edge' : 'chrome');
        return (mainWindowHandle !== 0 || windowTitle.length > 0) &&
          windowTitle.includes(browserIdentity);
      });
    }

    const app = KNOWN_APPS[name];
    if (app?.closeStrategy === 'window' && Array.isArray(app.preferredTitleTokens) && app.preferredTitleTokens.length > 0) {
      const identityTokens = app.preferredTitleTokens
        .map(token => String(token || '').trim().toLowerCase())
        .filter(Boolean);
      if (identityTokens.length > 0) {
        return (Array.isArray(processes) ? processes : []).filter(process => {
          const windowTitle = String(process?.MainWindowTitle || '').trim().toLowerCase();
          const mainWindowHandle = Number(process?.MainWindowHandle || 0);
          return (mainWindowHandle !== 0 || windowTitle.length > 0) &&
            identityTokens.some(token => Boolean(token) && windowTitle.includes(token));
        });
      }
    }

    return processes;
  }

  _buildCloseAmbiguity(name, processes) {
    const visibleTargets = this._visibleCloseTargets(processes);
    if (visibleTargets.length <= 1) {
      return null;
    }

    const choices = visibleTargets.slice(0, 8).map((process, index) => ({
      index: index + 1,
      id: Number(process?.Id) || null,
      title: String(process?.MainWindowTitle || '').trim() || String(process?.ProcessName || name),
      processName: String(process?.ProcessName || '').trim()
    }));

    return {
      success: false,
      needsClarification: true,
      error: this._buildAmbiguousCloseMessage(name, choices),
      data: {
        app: name,
        matchCount: visibleTargets.length,
        choices
      }
    };
  }

  async _closeSelectedProcess(name, options = {}) {
    const processId = Number(options.processId || options.targetProcessId);
    const title = String(options.windowTitle || options.targetWindowTitle || '').trim().toLowerCase();
    if ((!Number.isFinite(processId) || processId <= 0) && !title) {
      return null;
    }

    const processNames = this._resolveProcessCandidates(name);
    const candidates = this._filterCloseTargets(
      name,
      await this._findRunningProcesses(name, processNames)
    );
    const target = candidates.find(process => {
      if (Number.isFinite(processId) && processId > 0 && Number(process?.Id) === processId) {
        return true;
      }
      return title && String(process?.MainWindowTitle || '').trim().toLowerCase().includes(title);
    });

    if (!target) {
      return { success: false, error: `Could not find the selected ${name} window` };
    }

    await this._closeProcessesGracefully([target]);
    await this._sleep(900);

    const stillRunning = (await this._findRunningProcesses(name, processNames))
      .some(process => Number(process?.Id) === Number(target.Id));
    if (stillRunning && !this._isBrowserAppName(name)) {
      await this._forceTerminateProcesses([target]);
      await this._sleep(700);
    }

    const verifiedClosed = !(await this._findRunningProcesses(name, processNames))
      .some(process => Number(process?.Id) === Number(target.Id));
    if (!verifiedClosed) {
      return {
        success: false,
        error: `Could not verify that ${name} closed`,
        data: {
          app: name,
          targetProcessId: Number(target.Id) || null,
          verified: false
        }
      };
    }

    return {
      success: true,
      data: {
        app: name,
        closedCount: 1,
        closeMethod: 'window',
        matchedWindow: String(target.MainWindowTitle || '').trim() || null,
        processName: String(target.ProcessName || '').trim() || null,
        verified: true
      }
    };
  }

  _visibleCloseTargets(processes) {
    const unique = new Map();
    (Array.isArray(processes) ? processes : []).forEach(process => {
      const id = Number(process?.Id);
      const title = String(process?.MainWindowTitle || '').trim();
      const handle = Number(process?.MainWindowHandle || 0);
      if (!title && handle === 0) {
        return;
      }
      const key = Number.isFinite(id) && id > 0 ? `id:${id}` : `${process?.ProcessName || ''}:${title}`;
      if (!unique.has(key)) {
        unique.set(key, process);
      }
    });
    return Array.from(unique.values());
  }

  _buildAmbiguousCloseMessage(name, choices) {
    const labels = choices.map(choice => `${choice.index}. ${choice.title}`).join('; ');
    return `Multiple ${name} windows are open. Please say which one to close: ${labels}`;
  }

  async _buildAlreadyOpenClarification(name) {
    name = this._normalizeAppName(name);
    const app = KNOWN_APPS[name];
    const processNames = this._resolveProcessCandidates(name);
    const visibleTargets = this._visibleCloseTargets(
      this._filterCloseTargets(name, await this._findRunningProcesses(name, processNames))
    );

    if (visibleTargets.length === 0 && app?.closeStrategy === 'window') {
      const existingWindow = this.windowSession.findWindow(app.windowQuery || name, {
        ...this._windowMatchOptions(name, app)
      });
      if (existingWindow) {
        visibleTargets.push({
          Id: existingWindow.id,
          ProcessName: existingWindow.processName,
          MainWindowTitle: existingWindow.title,
          MainWindowHandle: existingWindow.handle
        });
      }
    }

    if (visibleTargets.length === 0) {
      return null;
    }

    const choices = visibleTargets.slice(0, 4).map((process, index) => ({
      index: index + 1,
      id: Number(process?.Id) || null,
      title: String(process?.MainWindowTitle || '').trim() || String(process?.ProcessName || name),
      processName: String(process?.ProcessName || '').trim()
    }));

    return {
      success: false,
      needsClarification: true,
      error: `${name} is already open. Do you want me to open another window?`,
      data: {
        clarificationType: 'app.open.alreadyOpen',
        app: name,
        matchCount: visibleTargets.length,
        choices,
        confirmEntities: { forceNewWindow: true, skipAlreadyOpenCheck: true }
      }
    };
  }

  _isBrowserAppName(name) {
    return BROWSER_APP_NAMES.has(this._normalizeAppName(name));
  }

  _isSharedBrowserProcess(processName) {
    const normalized = Normalizer.normalizeText(processName);
    return ['chrome', 'msedge', 'firefox', 'brave'].includes(normalized);
  }

  _failure(error, code = 'app.error', data = {}) {
    return {
      success: false,
      error,
      code,
      data: {
        verified: false,
        validation: 'failed',
        ...data
      }
    };
  }

  _validateAppName(appName) {
    const raw = String(appName ?? '').trim();
    if (!raw) {
      return { valid: false, error: 'No application name provided' };
    }
    if (raw.length > APP_NAME_MAX_LENGTH) {
      return { valid: false, error: 'Application name is too long' };
    }
    if (/[\x00-\x1f\x7f]/.test(raw)) {
      return { valid: false, error: 'Application name contains invalid characters' };
    }
    const displayName = Normalizer.normalizeText(raw);
    const name = this._normalizeAppName(raw);
    if (!name) {
      return { valid: false, error: 'No application name provided' };
    }
    return { valid: true, raw, displayName, name };
  }

  _normalizeAppName(appName) {
    const normalized = Normalizer.normalizeText(appName);
    return APP_ALIASES.get(normalized) || normalized;
  }

  _windowMatchOptions(name, app = KNOWN_APPS[name]) {
    const browserApp = this._isBrowserAppName(name);
    return {
      preferredTitleTokens: browserApp
        ? [name === 'msedge' ? 'edge' : name]
        : (app?.preferredTitleTokens || [name]),
      preferredProcessNames: app?.preferredProcessNames || [app?.processName, app?.cmd]
        .filter(Boolean),
      excludeTitleTokens: [],
      requireTitleTokenMatch: browserApp
    };
  }

  async findVisibleApp(appName, options = {}) {
    const name = this._normalizeAppName(appName);
    if (!name) return null;
    const processNames = this._resolveProcessCandidates(name);
    const processTarget = this._visibleCloseTargets(
      this._filterCloseTargets(name, await this._findRunningProcesses(name, processNames))
    )[0];
    if (processTarget) {
      return processTarget;
    }

    // Get-Process exposes only one MainWindowTitle per process. Chromium can
    // own a regular browser window and one or more PWA windows at the same
    // time, so inspect every top-level browser window before deciding that the
    // browser is closed and launching another instance.
    if (this._isBrowserAppName(name) && typeof this.windowSession.listProcessWindows === 'function') {
      const nativeWindows = this.windowSession.listProcessWindows(processNames)
        .map(window => ({
          Id: window.id,
          ProcessName: window.processName,
          MainWindowTitle: window.title,
          MainWindowHandle: window.handle
        }));
      const browserWindow = this._visibleCloseTargets(
        this._filterCloseTargets(name, nativeWindows)
      )[0];
      if (browserWindow) return browserWindow;
    }

    if (options.allowWindowFallback === false) return null;

    const app = KNOWN_APPS[name];
    const windowTarget = this.windowSession.findWindow(app?.windowQuery || name, {
      ...this._windowMatchOptions(name, app)
    });
    if (!windowTarget) return null;
    return {
      Id: windowTarget.id,
      ProcessName: windowTarget.processName,
      MainWindowTitle: windowTarget.title,
      MainWindowHandle: windowTarget.handle
    };
  }

  async waitForVisibleApp(appName, options = {}) {
    const attempts = Math.max(1, Number(options.attempts) || 2);
    const intervalMs = Math.max(0, Number(options.intervalMs) || 150);
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const target = await this.findVisibleApp(appName, {
        allowWindowFallback: attempt === attempts - 1
      });
      if (target) return target;
      if (attempt < attempts - 1) await this._sleep(intervalMs);
    }
    return null;
  }

  async waitForAppClosed(appName, options = {}) {
    const attempts = Math.max(1, Number(options.attempts) || 3);
    const intervalMs = Math.max(0, Number(options.intervalMs) || 150);
    const allowWindowFallback = options.allowWindowFallback !== false;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (!await this.findVisibleApp(appName, {
        allowWindowFallback: allowWindowFallback && attempt === attempts - 1
      })) return true;
      if (attempt < attempts - 1) await this._sleep(intervalMs);
    }
    return false;
  }

  async _focusExistingApp(name, target) {
    const app = KNOWN_APPS[name];
    const title = String(target?.MainWindowTitle || '').trim();
    const focusResult = this.windowSession.focusWindow(title || app?.windowQuery || name, {
      ...this._windowMatchOptions(name, app)
    });
    if (!focusResult.success) return null;
    return {
      success: true,
      data: {
        app: name,
        launchMethod: 'focus-existing',
        matchedWindow: focusResult.data?.matchedWindow || title || null,
        processName: focusResult.data?.processName || target?.ProcessName || null,
        verified: true
      }
    };
  }

  async _getRunningProcessDetails() {
    const now = Date.now();
    if (this._processDetailsCache && now < this._processDetailsCacheExpiresAt) {
      return this._processDetailsCache;
    }

    try {
      const stdout = await execPs(
        'Get-Process | Select-Object Id,ProcessName,MainWindowTitle,MainWindowHandle | ConvertTo-Json -Compress',
        PROCESS_DETAILS_TIMEOUT_MS
      );

      this._processDetailsCache = parseJsonObjectArray(stdout);
      this._processDetailsCacheExpiresAt = now + PROCESS_DETAILS_CACHE_TTL_MS;
      return this._processDetailsCache;
    } catch (err) {
      this.logger.warn('Failed to list running processes', err.message);
      this._processDetailsCache = [];
      this._processDetailsCacheExpiresAt = now + 500;
      return [];
    }
  }

  async _closeProcesses(processes) {
    return this._closeProcessesGracefully(processes);
  }

  async _closeProcessesGracefully(processes) {
    const ids = Array.from(new Set(
      processes
        .map(process => Number(process?.Id))
        .filter(id => Number.isFinite(id) && id > 0)
    ));

    if (ids.length === 0) {
      return false;
    }

    const gracefulScript = [
      '$ids = @(' + ids.join(',') + ')',
      'foreach ($id in $ids) {',
      '  $target = Get-Process -Id $id -ErrorAction SilentlyContinue | Select-Object -First 1',
      '  if (-not $target) { continue }',
      '  try { if ($target.MainWindowHandle -ne 0) { $target.CloseMainWindow() | Out-Null } } catch {}',
      '}'
    ].join('; ');

    try {
      await execFileP('powershell.exe', [
        '-NoProfile',
        '-Command',
        gracefulScript
      ], PS_EXEC_OPTS);
      this._invalidateProcessDetailsCache();
      return true;
    } catch (err) {
      return false;
    }
  }

  async _forceTerminateProcesses(processes) {
    const terminableProcesses = processes.filter(process => !PROTECTED_HOST_PROCESSES.has(
      Normalizer.normalizeText(process?.ProcessName).replace(/\s+/g, '')
    ));
    const ids = Array.from(new Set(
      terminableProcesses
        .map(process => Number(process?.Id))
        .filter(id => Number.isFinite(id) && id > 0)
    ));
    let terminated = false;

    if (ids.length > 0) {
      try {
        await execFileP('powershell.exe', [
          '-NoProfile',
          '-Command',
          `Stop-Process -Id ${ids.join(',')} -Force -ErrorAction SilentlyContinue`
        ], PS_EXEC_OPTS);
        this._invalidateProcessDetailsCache();
        terminated = true;
      } catch (err) {}
    }

    for (const process of terminableProcesses) {
      const processId = Number(process?.Id);
      try {
        if (Number.isFinite(processId) && processId > 0) {
          await execFileP('taskkill.exe', ['/PID', String(processId), '/T', '/F'], PS_EXEC_OPTS);
          this._invalidateProcessDetailsCache();
          terminated = true;
          continue;
        }
      } catch (err) {}
    }

    return terminated;
  }

  _invalidateProcessDetailsCache() {
    this._processDetailsCache = null;
    this._processDetailsCacheExpiresAt = 0;
  }

  async _sleep(milliseconds) {
    await asyncSleep(milliseconds);
  }

  async _launchTarget(target, args = [], options = {}) {
    const launch = typeof launcher.launchTargetAsync === 'function'
      ? launcher.launchTargetAsync
      : async (...callArgs) => launcher.launchTarget(...callArgs);
    const result = await launch(target, args, options);
    this._invalidateProcessDetailsCache();
    return result;
  }

  async _waitForProcessesGone(name, processNames, processIds = [], options = {}) {
    const ids = new Set(
      (Array.isArray(processIds) ? processIds : [])
        .map(id => Number(id))
        .filter(id => Number.isFinite(id) && id > 0)
    );
    const attempts = Math.max(1, Number(options.attempts) || 5);
    const intervalMs = Math.max(0, Number(options.intervalMs) || 150);
    let remaining = [];

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      this._invalidateProcessDetailsCache();
      remaining = this._filterCloseTargets(
        name,
        await this._findRunningProcesses(name, processNames)
      );
      const stillTargeted = ids.size === 0
        ? remaining
        : remaining.filter(process => ids.has(Number(process?.Id)));
      if (stillTargeted.length === 0) {
        return { closed: true, remaining };
      }
      if (attempt < attempts - 1) {
        await this._sleep(intervalMs);
      }
    }

    return { closed: false, remaining };
  }

  async switchTo(appName) {
    const validation = this._validateAppName(appName);
    if (!validation.valid) return this._failure(validation.error, 'app.switch.validation');

    const { name, displayName } = validation;
    const app = KNOWN_APPS[name];
    const processCandidates = this._resolveProcessCandidates(name);
    const target = await this.findVisibleApp(name, { allowWindowFallback: true });
    const activationTarget = String(target?.MainWindowTitle || app?.windowQuery || app?.cmd || name).trim();

    try {
      await execFileP('powershell.exe', [
        '-NoProfile',
        '-Command',
        [
          '$ErrorActionPreference = \'Stop\'',
          `$target = '${escapePowerShell(activationTarget)}'`,
          '$shell = New-Object -ComObject WScript.Shell',
          'if (-not $shell.AppActivate($target)) { exit 2 }'
        ].join('; ')
      ], PS_EXEC_OPTS);
      return {
        success: true,
        data: {
          app: displayName,
          appId: name,
          matchedWindow: target?.MainWindowTitle || null,
          processName: target?.ProcessName || processCandidates[0] || null,
          verified: true
        }
      };
    } catch (err) {
      return this._failure(`Could not switch to: ${displayName}`, 'app.switch.failed', {
        app: displayName,
        appId: name
      });
    }
  }

  async isRunning(appName) {
    const validation = this._validateAppName(appName);
    if (!validation.valid) return { success: false, error: validation.error };
    const name = validation.name;
    const processNames = this._resolveProcessCandidates(name);
    const processes = this._filterCloseTargets(
      name,
      await this._findRunningProcesses(name, processNames)
    );
    return {
      success: true,
      data: {
        app: validation.displayName,
        appId: name,
        running: processes.length > 0,
        processCount: processes.length,
        windows: this._visibleCloseTargets(processes).map(process => ({
          id: Number(process.Id) || null,
          title: String(process.MainWindowTitle || '').trim(),
          processName: String(process.ProcessName || '').trim()
        }))
      }
    };
  }

  async getRunningApps() {
    try {
      const stdout = await execPs([
        'Get-Process |',
        'Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle } |',
        'Select-Object Id,ProcessName,MainWindowTitle,MainWindowHandle |',
        'ConvertTo-Json -Compress'
      ].join(' '));
      const processes = parseJsonObjectArray(stdout)
        .map(process => ({
          id: Number(process.Id) || null,
          processName: String(process.ProcessName || '').trim(),
          title: String(process.MainWindowTitle || '').trim(),
          handle: Number(process.MainWindowHandle || 0)
        }))
        .filter(process => process.processName && process.title);
      const dedupedProcesses = processes.filter((process, index, self) =>
        index === self.findIndex(p => p.id === process.id)
      );
      const uniqueNames = Array.from(new Set(dedupedProcesses.map(p => p.processName))).slice(0, 12);
      return {
        success: true,
        data: {
          processes: uniqueNames,
          windows: dedupedProcesses,
          count: dedupedProcesses.length,
          verified: true
        }
      };
    } catch (err) {
      return this._failure('Could not list running applications', 'app.list.failed', {
        reason: err.message
      });
    }
  }
}

module.exports = AppController;
