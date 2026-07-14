const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildDataPaths, Logger } = require('../assistant/Data');

const CAPTURE_TIMEOUT_MS = 12000;
const MIN_SCREENSHOT_BYTES = 128;
const SAFE_BASENAME_PATTERN = /^OpenX-\d{4}-\d{2}-\d{2}T[\d-]+Z\.png$/;

function escapePowerShell(value) {
  return String(value ?? '').replace(/'/g, "''");
}

function verification(status, check, detail = {}) {
  return { status, check, ...detail };
}

function normalizeDirectory(value, fallback) {
  const selected = String(value || fallback || '').trim();
  return path.resolve(selected || fallback);
}

class ScreenshotController {
  constructor(config = {}) {
    this.logger = new Logger(config?.logging || { level: 'info' });
    const dataPaths = config?.app?.dataPaths || buildDataPaths(config);
    this.outputDirectory = normalizeDirectory(config?.screenshots?.directory, dataPaths.screenshotsDir);
    this.timeoutMs = Number.isFinite(config?.screenshots?.timeoutMs)
      ? Math.max(1000, Number(config.screenshots.timeoutMs))
      : CAPTURE_TIMEOUT_MS;
    this.commandRunner = config?.screenshots?.commandRunner || null;
    this.clock = typeof config?.screenshots?.clock === 'function'
      ? config.screenshots.clock
      : () => new Date();
  }

  capture(options = {}) {
    const directory = normalizeDirectory(options.directory, this.outputDirectory);
    const filePath = this._nextScreenshotPath(directory);
    try {
      fs.mkdirSync(directory, { recursive: true });

      if (!this._isSafeOutputPath(filePath, directory)) {
        return this._failure('Screenshot output path was rejected', 'screenshot-path', { filePath, directory });
      }

      this._runCaptureScript(filePath);
      const verified = this._verifyScreenshotFile(filePath);
      if (!verified.ok) {
        return this._failure(verified.error, 'screenshot-file', { filePath, directory });
      }

      return {
        success: true,
        data: {
          operation: 'screenshot.capture',
          filePath,
          filename: path.basename(filePath),
          directory,
          size: verified.size,
          extension: '.png',
          method: 'System.Drawing.CopyFromScreen',
          source: 'windows-desktop',
          verified: true,
          verification: verification('passed', 'screenshot-file-created', {
            filePath,
            size: verified.size
          }),
          responseVariantSeed: `screenshot:${path.basename(filePath)}:${verified.size}`
        }
      };
    } catch (error) {
      this.logger.warn('Screenshot capture failed', error.message);
      return this._failure('Could not take a screenshot', 'screenshot-capture', {
        filePath,
        directory,
        reason: error.message
      });
    }
  }

  startRecording() {
    return this._recordingUnavailable('screen-recording.start');
  }

  stopRecording() {
    return this._recordingUnavailable('screen-recording.stop');
  }

  _runCaptureScript(filePath) {
    const script = this._buildCaptureScript(filePath);
    if (typeof this.commandRunner === 'function') {
      return this.commandRunner(script, { filePath, timeoutMs: this.timeoutMs });
    }

    return execFileSync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-STA',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      script
    ], {
      encoding: 'utf8',
      timeout: this.timeoutMs,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });
  }

  _verifyScreenshotFile(filePath) {
    try {
      const stat = fs.statSync(filePath);
      if (!stat.isFile()) {
        return { ok: false, error: 'Screenshot capture did not produce a file' };
      }
      if (stat.size < MIN_SCREENSHOT_BYTES) {
        return { ok: false, error: 'Screenshot file is empty or incomplete' };
      }
      return { ok: true, size: stat.size };
    } catch (error) {
      return { ok: false, error: 'Screenshot capture did not produce a file' };
    }
  }

  _buildCaptureScript(filePath) {
    const escapedPath = escapePowerShell(filePath);
    return `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
if ($bounds.Width -le 0 -or $bounds.Height -le 0) {
  throw "No active virtual screen was reported"
}
$bitmap = $null
$graphics = $null
try {
  $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CopyFromScreen($bounds.Left, $bounds.Top, 0, 0, $bounds.Size, [System.Drawing.CopyPixelOperation]::SourceCopy)
  $bitmap.Save('${escapedPath}', [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  if ($graphics -ne $null) { $graphics.Dispose() }
  if ($bitmap -ne $null) { $bitmap.Dispose() }
}
`;
  }

  _nextScreenshotPath(directory) {
    const stamp = this._timestamp();
    return path.join(directory, `OpenX-${stamp}.png`);
  }

  _isSafeOutputPath(filePath, directory) {
    const resolvedFile = path.resolve(filePath);
    const resolvedDirectory = path.resolve(directory);
    const relative = path.relative(resolvedDirectory, resolvedFile);
    return relative &&
      !relative.startsWith('..') &&
      !path.isAbsolute(relative) &&
      SAFE_BASENAME_PATTERN.test(path.basename(resolvedFile));
  }

  _timestamp() {
    return this.clock().toISOString().replace(/[:.]/g, '-');
  }

  _failure(error, check, detail = {}) {
    return {
      success: false,
      error,
      data: {
        operation: detail.operation || 'screenshot.capture',
        verified: false,
        verification: verification('failed', check, {
          message: error,
          ...detail
        })
      }
    };
  }

  _recordingUnavailable(operation) {
    return {
      success: false,
      error: 'Screen recording is not connected yet. Use Windows Snipping Tool recording for now.',
      data: {
        operation,
        verified: false,
        supported: false,
        verification: verification('failed', 'screen-recording-unavailable', {
          message: 'Screen recording requires a consent-based Windows Graphics Capture or Snipping Tool integration.'
        })
      }
    };
  }
}

module.exports = ScreenshotController;
module.exports._private = {
  escapePowerShell,
  normalizeDirectory,
  SAFE_BASENAME_PATTERN
};
