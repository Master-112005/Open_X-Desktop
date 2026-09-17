'use strict';

const { execFile } = require('child_process');
const util = require('util');
const Logger = require('../assistant/Data').Logger;

const POWERSHELL_EXECUTABLE = 'powershell.exe';
const DEFAULT_TIMEOUT_MS = 30000;

const NATIVE_BOOTSTRAP = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class OxMouseApi {
  [StructLayout(LayoutKind.Sequential)]
  public struct NativePoint { public int X; public int Y; }
  [DllImport("user32.dll")]
  public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")]
  public static extern bool GetCursorPos(out NativePoint pt);
  [DllImport("user32.dll")]
  public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
}
'@ -ErrorAction SilentlyContinue | Out-Null
`;

class MouseController {
  constructor(config = {}) {
    this.logger = new Logger(config?.logging || { level: 'info' });
    this.commandRunner = config?.mouse?.commandRunner || null;
    this.defaultTimeoutMs = Number(config?.mouse?.commandTimeoutMs || DEFAULT_TIMEOUT_MS);
  }

  _runPowerShell(script, options = {}) {
    if (this.commandRunner) {
      return this.commandRunner(POWERSHELL_EXECUTABLE, [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        script
      ], {
        timeout: Number(options.timeout || this.defaultTimeoutMs),
        windowsHide: true,
        encoding: options.encoding
      });
    }
    return util.promisify(execFile)(POWERSHELL_EXECUTABLE, [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      script
    ], {
      timeout: Number(options.timeout || this.defaultTimeoutMs),
      windowsHide: true,
      encoding: options.encoding,
      maxBuffer: 8 * 1024 * 1024
    });
  }

  _parsePoint(output) {
    const text = String(output || '');
    const match = text.match(/X\s*=\s*(-?\d+),?\s*Y\s*=\s*(-?\d+)/i);
    if (!match) return null;
    const x = Number(match[1]);
    const y = Number(match[2]);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }

  async getPosition() {
    try {
      const result = await this._runPowerShell(
        `${NATIVE_BOOTSTRAP}; [OxMouseApi.NativePoint]$pt = New-Object OxMouseApi+NativePoint; [OxMouseApi]::GetCursorPos([ref]$pt) | Out-Null; Write-Output ("X={0},Y={1}" -f $pt.X, $pt.Y)`,
        { encoding: 'utf8' }
      );
      const point = this._parsePoint(result?.stdout || result);
      if (!point) {
        return { success: false, error: 'Could not read the current mouse position' };
      }
      return { success: true, data: point };
    } catch (err) {
      this.logger.error('Mouse position read failed', err);
      return { success: false, error: err.message };
    }
  }

  async move(x, y) {
    const targetX = Number(x);
    const targetY = Number(y);
    if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
      return { success: false, error: 'Mouse move requires numeric x and y coordinates' };
    }
    try {
      await this._runPowerShell(
        `${NATIVE_BOOTSTRAP}; [OxMouseApi]::SetCursorPos(${Math.round(targetX)}, ${Math.round(targetY)}) | Out-Null; Write-Output ("X={0},Y={1}" -f ${Math.round(targetX)}, ${Math.round(targetY)})`,
        { encoding: 'utf8' }
      );
      return { success: true, data: { x: Math.round(targetX), y: Math.round(targetY) } };
    } catch (err) {
      this.logger.error('Mouse move failed', err);
      return { success: false, error: err.message };
    }
  }

  async click(x, y, options = {}) {
    const button = String(options?.button || 'left').toLowerCase();
    const flags = MOUSE_EVENT_FLAGS[button === 'right' ? 'rightDown' : button === 'middle' ? 'middleDown' : 'leftDown'];
    if (!flags) {
      return { success: false, error: `Unsupported mouse button: ${button}` };
    }
    const targetX = Number(x);
    const targetY = Number(y);
    if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
      return { success: false, error: 'Mouse click requires numeric x and y coordinates' };
    }
    try {
      await this._runPowerShell(
        `${NATIVE_BOOTSTRAP}; [OxMouseApi]::SetCursorPos(${Math.round(targetX)}, ${Math.round(targetY)}) | Out-Null; [OxMouseApi]::mouse_event(${flags.down}, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds ${options.releaseDelayMs || 40}; [OxMouseApi]::mouse_event(${flags.up}, 0, 0, 0, [UIntPtr]::Zero)`,
        { encoding: 'utf8' }
      );
      return {
        success: true,
        data: { x: Math.round(targetX), y: Math.round(targetY), button }
      };
    } catch (err) {
      this.logger.error('Mouse click failed', err);
      return { success: false, error: err.message };
    }
  }
}

const MOUSE_EVENT_FLAGS = {
  leftDown: { down: 0x0002, up: 0x0004 },
  rightDown: { down: 0x0008, up: 0x0010 },
  middleDown: { down: 0x0020, up: 0x0040 }
};

module.exports = MouseController;