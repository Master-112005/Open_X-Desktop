const os = require('os');
const { execFileSync } = require('child_process');
const Logger = require('../assistant/Data').Logger;
const WindowsSessionController = require('./common/windows-session');

class WindowsController {
  constructor(config) {
    this.logger = new Logger(config?.logging || { level: 'info' });
    this.session = new WindowsSessionController(config);
    this.commandRunner = config?.windows?.commandRunner || execFileSync;
    this.commandTimeoutMs = Number(config?.windows?.commandTimeoutMs || 3000);
    this.shutdownDelaySeconds = this._normalizeDelay(config?.windows?.shutdownDelaySeconds, 5);
    this.restartDelaySeconds = this._normalizeDelay(config?.windows?.restartDelaySeconds, 5);
    this.dryRun = config?.windows?.dryRun === true;
  }

  shutdown() {
    return this._dispatchPowerAction({
      operation: 'shutdown',
      executable: 'shutdown.exe',
      args: ['/s', '/t', String(this.shutdownDelaySeconds), '/c', 'OpenX initiated shutdown'],
      delay: this.shutdownDelaySeconds,
      validationCheck: 'windows-shutdown-request'
    });
  }

  restart() {
    return this._dispatchPowerAction({
      operation: 'restart',
      executable: 'shutdown.exe',
      args: ['/r', '/t', String(this.restartDelaySeconds), '/c', 'OpenX initiated restart'],
      delay: this.restartDelaySeconds,
      validationCheck: 'windows-restart-request'
    });
  }

  sleep() {
    return this._dispatchPowerAction({
      operation: 'sleep',
      executable: 'rundll32.exe',
      args: ['powrprof.dll,SetSuspendState', '0,1,0'],
      validationCheck: 'windows-sleep-request',
      caveat: 'Windows may hibernate instead of sleeping when hibernation is enabled.'
    });
  }

  lock() {
    return this._dispatchPowerAction({
      operation: 'lock',
      executable: 'rundll32.exe',
      args: ['user32.dll,LockWorkStation'],
      validationCheck: 'windows-lock-request'
    });
  }

  minimizeWindow(windowName) {
    if (/^(?:all\s+windows?|all|everything)$/i.test(String(windowName || '').trim())) {
      return this.session.minimizeAllWindows();
    }
    return this.session.minimizeWindow(windowName);
  }

  maximizeWindow(windowName) {
    return this.session.maximizeWindow(windowName);
  }

  closeWindow(windowName) {
    return this.session.closeWindow(windowName);
  }

  sendKeys(windowName, keys, options = {}) {
    return this.session.sendKeys(windowName, keys, options);
  }

  listWindows() {
    return this.session.listWindows();
  }

  listBrowserTabs(processNames) {
    return this.session.listBrowserTabs(processNames);
  }

  listProcessWindows(processNames) {
    return this.session.listProcessWindows(processNames);
  }

  closeBrowserTab(tabTitle, processNames) {
    return this.session.closeBrowserTab(tabTitle, processNames);
  }

  focusBrowserTab(tabTitle, processNames) {
    return this.session.focusBrowserTab(tabTitle, processNames);
  }

  findWindow(windowName, options = {}) {
    return this.session.findWindow(windowName, options);
  }

  hibernate() {
    return this._dispatchPowerAction({
      operation: 'hibernate',
      executable: 'shutdown.exe',
      args: ['/h'],
      validationCheck: 'windows-hibernate-request'
    });
  }

  logOff() {
    return this.logoff();
  }

  logoff() {
    return this._dispatchPowerAction({
      operation: 'logoff',
      executable: 'shutdown.exe',
      args: ['/l'],
      validationCheck: 'windows-logoff-request'
    });
  }

  _normalizeDelay(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(0, Math.min(600, Math.round(number)));
  }

  _dispatchPowerAction({ operation, executable, args = [], delay = null, validationCheck, caveat = null }) {
    try {
      if (!this.dryRun) {
        this.commandRunner(executable, args, {
          timeout: this.commandTimeoutMs,
          windowsHide: true,
          stdio: 'ignore'
        });
      }

      return this._success(operation, {
        executable,
        args: [...args],
        delay,
        caveat,
        dryRun: this.dryRun
      }, validationCheck);
    } catch (err) {
      return this._failure(err, operation, {
        executable,
        args: [...args],
        delay
      }, validationCheck);
    }
  }

  _success(operation, details = {}, validationCheck = `windows-${operation}-request`) {
    return {
      success: true,
      data: {
        action: operation,
        operation,
        delay: details.delay,
        platform: os.platform(),
        command: details.executable,
        commandArgs: details.args,
        dryRun: details.dryRun === true,
        caveat: details.caveat || null,
        controllerVerified: true,
        verification: {
          status: 'unknown',
          check: validationCheck,
          reason: 'Windows accepted the command dispatch; final power/session state is not safely observable before transition.'
        },
        responseVariantSeed: `windows:${operation}:${details.delay ?? ''}:${Date.now()}`
      }
    };
  }

  _failure(error, operation, details = {}, validationCheck = `windows-${operation}-request`) {
    return {
      success: false,
      error: error?.message || `Windows ${operation} request failed`,
      data: {
        action: operation,
        operation,
        delay: details.delay,
        platform: os.platform(),
        command: details.executable,
        commandArgs: details.args,
        controllerVerified: false,
        verification: {
          status: 'failed',
          check: validationCheck
        }
      }
    };
  }
}

module.exports = WindowsController;
