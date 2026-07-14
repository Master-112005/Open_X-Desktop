const { execFileSync } = require('child_process');
const Logger = require('../assistant/Data').Logger;

const BRIGHTNESS_TIMEOUT_MS = 5500;
const DEFAULT_STEP = 10;
const DEFAULT_BRIGHTNESS = 50;
const MAX_PERCENT = 100;

function clampPercent(value, fallback = DEFAULT_BRIGHTNESS) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(0, Math.min(MAX_PERCENT, Math.round(number)));
}

function normalizeStep(value, fallback = DEFAULT_STEP) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return fallback;
  }
  return Math.max(1, Math.min(MAX_PERCENT, Math.round(number)));
}

function parseOutputLines(output) {
  return String(output || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function parseNumber(output) {
  const lines = parseOutputLines(output);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const value = Number.parseInt(lines[index], 10);
    if (Number.isFinite(value)) {
      return clampPercent(value);
    }
  }
  return null;
}

function verification(status, check, detail = {}) {
  return { status, check, ...detail };
}

class BrightnessController {
  constructor(config = {}) {
    this.logger = new Logger(config?.logging || { level: 'info' });
    this.step = normalizeStep(config?.system?.brightnessStep, DEFAULT_STEP);
    this.lastKnownBrightness = null;
    this.lastSetAt = 0;
    this.timeoutMs = Number.isFinite(config?.system?.brightnessTimeoutMs)
      ? Math.max(1000, Number(config.system.brightnessTimeoutMs))
      : BRIGHTNESS_TIMEOUT_MS;
    this.commandRunner = config?.system?.brightnessCommandRunner || null;
  }

  _run(script) {
    const wrapped = `
$ErrorActionPreference = 'Stop'
${script}
`;
    try {
      if (typeof this.commandRunner === 'function') {
        return this.commandRunner(wrapped);
      }
      return execFileSync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        wrapped
      ], {
        encoding: 'utf8',
        timeout: this.timeoutMs,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      }).trim();
    } catch (error) {
      this.logger.warn('Windows brightness command failed', error.message);
      return null;
    }
  }

  _failure(error, operation, detail = {}) {
    return {
      success: false,
      error,
      data: {
        operation,
        supported: false,
        verified: false,
        verification: verification('failed', `${operation}-failed`, {
          message: error,
          ...detail
        })
      }
    };
  }

  _success(operation, data = {}) {
    return {
      success: true,
      data: {
        operation,
        method: 'WmiMonitorBrightnessMethods.WmiSetBrightness',
        source: 'windows-wmi',
        supported: true,
        verified: true,
        ...data,
        verification: verification('passed', data.verificationCheck || 'brightness-readback', {
          value: data.value,
          requestedValue: data.requestedValue
        })
      }
    };
  }

  _readBrightness() {
    const output = this._run(`
$brightness = Get-CimInstance -Namespace "root/WMI" -ClassName WmiMonitorBrightness -ErrorAction Stop |
  Where-Object { $_.Active -eq $true } |
  Select-Object -First 1
if (-not $brightness) {
  $brightness = Get-CimInstance -Namespace "root/WMI" -ClassName WmiMonitorBrightness -ErrorAction Stop |
    Select-Object -First 1
}
if (-not $brightness) {
  throw "Brightness readback unavailable"
}
Write-Output $brightness.CurrentBrightness
`);
    const value = parseNumber(output);
    if (value !== null) {
      this.lastKnownBrightness = value;
    }
    return value;
  }

  getCurrentBrightness() {
    try {
      return this._readBrightness();
    } catch (error) {
      this.logger.warn('Failed to get brightness', error.message);
      return null;
    }
  }

  getState() {
    const value = this.getCurrentBrightness();
    if (value === null) {
      return this._failure('Brightness control not supported', 'brightness.get');
    }
    return this._success('brightness.get', {
      value,
      verificationCheck: 'brightness-readback'
    });
  }

  setBrightness(value) {
    const requestedValue = clampPercent(value, DEFAULT_BRIGHTNESS);
    try {
      const script = `
$monitor = Get-CimInstance -Namespace "root/WMI" -ClassName WmiMonitorBrightnessMethods -ErrorAction Stop |
  Select-Object -First 1
if (-not $monitor) {
  throw "Brightness control not supported"
}
Invoke-CimMethod -InputObject $monitor -MethodName WmiSetBrightness -Arguments @{ Timeout = 1; Brightness = ${requestedValue} } | Out-Null
Start-Sleep -Milliseconds 120
$current = Get-CimInstance -Namespace "root/WMI" -ClassName WmiMonitorBrightness -ErrorAction Stop |
  Where-Object { $_.Active -eq $true } |
  Select-Object -First 1
if (-not $current) {
  $current = Get-CimInstance -Namespace "root/WMI" -ClassName WmiMonitorBrightness -ErrorAction Stop |
    Select-Object -First 1
}
if (-not $current) {
  throw "Brightness readback unavailable"
}
Write-Output $current.CurrentBrightness
`;
      const actual = parseNumber(this._run(script));
      if (actual === null) {
        return this._failure('No brightness level returned from Windows', 'brightness.set', { requestedValue });
      }

      this.lastKnownBrightness = actual;
      this.lastSetAt = Date.now();
      this.logger.info(`Brightness set to ${actual}%`);
      return this._success('brightness.set', {
        value: actual,
        requestedValue,
        verificationCheck: actual === requestedValue ? 'brightness-set' : 'brightness-readback-adjusted'
      });
    } catch (error) {
      this.logger.error('Failed to set brightness', error.message);
      return this._failure('Brightness control not supported on this display', 'brightness.set', { requestedValue });
    }
  }

  increaseBrightness(amount = null) {
    const step = normalizeStep(amount, this.step);
    const current = this._getBrightnessBaseline();
    if (current === null) {
      return this._failure('Brightness control not supported', 'brightness.up');
    }
    return this.setBrightness(current + step);
  }

  decreaseBrightness(amount = null) {
    const step = normalizeStep(amount, this.step);
    const current = this._getBrightnessBaseline();
    if (current === null) {
      return this._failure('Brightness control not supported', 'brightness.down');
    }
    return this.setBrightness(current - step);
  }

  _getBrightnessBaseline() {
    if (Date.now() - this.lastSetAt <= 1500 && this.lastKnownBrightness !== null) {
      return this.lastKnownBrightness;
    }
    return this.getCurrentBrightness();
  }
}

module.exports = BrightnessController;
module.exports._private = {
  clampPercent,
  normalizeStep,
  parseNumber
};
