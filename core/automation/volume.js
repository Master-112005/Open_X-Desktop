const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);
const Logger = require('../assistant/Data').Logger;

const VOLUME_TIMEOUT_MS = 6500;
const DEFAULT_VOLUME = 50;
const DEFAULT_STEP = 5;
const MAX_PERCENT = 100;

const AUDIO_BRIDGE = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IAudioEndpointVolume {
  int RegisterControlChangeNotify(IntPtr pNotify);
  int UnregisterControlChangeNotify(IntPtr pNotify);
  int GetChannelCount(out uint pnChannelCount);
  int SetMasterVolumeLevel(float fLevelDB, Guid pguidEventContext);
  int SetMasterVolumeLevelScalar(float fLevel, Guid pguidEventContext);
  int GetMasterVolumeLevel(out float pfLevelDB);
  int GetMasterVolumeLevelScalar(out float pfLevel);
  int SetChannelVolumeLevel(uint nChannel, float fLevelDB, Guid pguidEventContext);
  int SetChannelVolumeLevelScalar(uint nChannel, float fLevel, Guid pguidEventContext);
  int GetChannelVolumeLevel(uint nChannel, out float pfLevelDB);
  int GetChannelVolumeLevelScalar(uint nChannel, out float pfLevel);
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, Guid pguidEventContext);
  int GetMute(out bool pbMute);
  int GetVolumeStepInfo(out uint pnStep, out uint pnStepCount);
  int VolumeStepUp(Guid pguidEventContext);
  int VolumeStepDown(Guid pguidEventContext);
  int QueryHardwareSupport(out uint pdwHardwareSupportMask);
  int GetVolumeRange(out float pflVolumeMindB, out float pflVolumeMaxdB, out float pflVolumeIncrementdB);
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDevice {
  int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, [MarshalAs(UnmanagedType.Interface)] out IAudioEndpointVolume ppInterface);
}

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDeviceEnumerator {
  int NotImpl1();
  int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice);
}

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
public class MMDeviceEnumeratorComObject {}

public static class AudioBridge {
  private static IAudioEndpointVolume GetEndpointVolume() {
    var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
    IMMDevice device;
    Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out device));
    Guid iid = typeof(IAudioEndpointVolume).GUID;
    IAudioEndpointVolume volume;
    Marshal.ThrowExceptionForHR(device.Activate(ref iid, 23, IntPtr.Zero, out volume));
    return volume;
  }

  public static int GetMasterVolume() {
    float level;
    Marshal.ThrowExceptionForHR(GetEndpointVolume().GetMasterVolumeLevelScalar(out level));
    return (int)Math.Round(level * 100);
  }

  public static int SetMasterVolume(int value) {
    float level = Math.Max(0, Math.Min(100, value)) / 100f;
    Marshal.ThrowExceptionForHR(GetEndpointVolume().SetMute(false, Guid.Empty));
    Marshal.ThrowExceptionForHR(GetEndpointVolume().SetMasterVolumeLevelScalar(level, Guid.Empty));
    return GetMasterVolume();
  }

  public static bool GetMute() {
    bool muted;
    Marshal.ThrowExceptionForHR(GetEndpointVolume().GetMute(out muted));
    return muted;
  }

  public static bool SetMute(bool muted) {
    Marshal.ThrowExceptionForHR(GetEndpointVolume().SetMute(muted, Guid.Empty));
    return GetMute();
  }
}
"@ -ErrorAction Stop
`;

function clampPercent(value, fallback = DEFAULT_VOLUME) {
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

function commandOutputText(output) {
  if (output && typeof output === 'object' && Object.prototype.hasOwnProperty.call(output, 'stdout')) {
    return String(output.stdout || '').trim();
  }
  return String(output || '').trim();
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

function parseBoolean(output) {
  const lines = parseOutputLines(output).map(line => line.toLowerCase());
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index] === 'true') return true;
    if (lines[index] === 'false') return false;
  }
  return null;
}

function parseAudioState(output) {
  const muted = parseBoolean(output);
  const volume = parseNumber(output);
  if (muted === null || volume === null) {
    return null;
  }
  return { muted, volume };
}

function verification(status, check, detail = {}) {
  return { status, check, ...detail };
}

class VolumeController {
  constructor(config = {}) {
    this.logger = new Logger(config?.logging || { level: 'info' });
    this.step = normalizeStep(config?.system?.volumeStep, DEFAULT_STEP);
    this.lastKnownVolume = DEFAULT_VOLUME;
    this.lastUnmutedVolume = DEFAULT_VOLUME;
    this.lastSetAt = 0;
    this.timeoutMs = Number.isFinite(config?.system?.volumeTimeoutMs)
      ? Math.max(1000, Number(config.system.volumeTimeoutMs))
      : VOLUME_TIMEOUT_MS;
    this.commandRunner = config?.system?.volumeCommandRunner || null;
  }

  async _run(body) {
    const script = `
$ErrorActionPreference = 'Stop'
${AUDIO_BRIDGE}
${body}
`;
    try {
      if (typeof this.commandRunner === 'function') {
        return await this.commandRunner(script);
      }
      const output = await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        script
      ], {
        encoding: 'utf8',
        timeout: this.timeoutMs
      });
      return commandOutputText(output);
    } catch (error) {
      this.logger.warn('Windows volume command failed', error.message);
      return null;
    }
  }

  async _getAudioState() {
    const output = await this._run(`
$muted = [AudioBridge]::GetMute()
$volume = [AudioBridge]::GetMasterVolume()
Write-Output $muted
Write-Output $volume
`);
    const state = parseAudioState(output);
    if (!state) {
      return null;
    }

    this._rememberVolume(state.volume, state.muted);
    return state;
  }

  _rememberVolume(volume, muted = false) {
    if (Number.isFinite(volume)) {
      this.lastKnownVolume = clampPercent(volume, this.lastKnownVolume);
      if (!muted && volume > 0) {
        this.lastUnmutedVolume = clampPercent(volume, this.lastUnmutedVolume);
      }
    }
  }

  _failure(error, operation, detail = {}) {
    return {
      success: false,
      error,
      data: {
        operation,
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
        method: 'IAudioEndpointVolume',
        source: 'windows-core-audio',
        verified: true,
        ...data,
        verification: verification('passed', data.verificationCheck || 'volume-readback', {
          value: data.value,
          muted: data.muted === true,
          requestedValue: data.requestedValue
        })
      }
    };
  }

  async getCurrentVolume() {
    try {
      const state = await this._getAudioState();
      if (!state) {
        return this.lastKnownVolume;
      }
      return state.muted ? 0 : state.volume;
    } catch (error) {
      this.logger.warn('Failed to get current volume', error.message);
      return this.lastKnownVolume;
    }
  }

  async getState() {
    const state = await this._getAudioState();
    if (!state) {
      return this._failure('Failed to read system volume', 'volume.get');
    }
    return this._success('volume.get', {
      value: state.muted ? 0 : state.volume,
      rawValue: state.volume,
      muted: state.muted,
      verificationCheck: 'volume-readback'
    });
  }

  async setVolume(value) {
    const requestedValue = clampPercent(value, DEFAULT_VOLUME);
    try {
      const actual = parseNumber(await this._run(`[AudioBridge]::SetMasterVolume(${requestedValue})`));
      if (actual === null) {
        return this._failure('No volume level returned from Windows', 'volume.set', { requestedValue });
      }

      this._rememberVolume(actual, false);
      this.lastSetAt = Date.now();
      this.logger.info(`Volume set to ${actual}%`);
      return this._success('volume.set', {
        value: actual,
        requestedValue,
        muted: false,
        verificationCheck: actual === requestedValue ? 'volume-set' : 'volume-readback-adjusted'
      });
    } catch (error) {
      this.logger.error('Failed to set volume', error.message);
      return this._failure('Failed to set system volume', 'volume.set', { requestedValue });
    }
  }

  async increaseVolume(amount = null) {
    const step = normalizeStep(amount, this.step);
    const current = await this._getVolumeBaseline();
    return this.setVolume(current + step);
  }

  async decreaseVolume(amount = null) {
    const step = normalizeStep(amount, this.step);
    const current = await this._getVolumeBaseline();
    return this.setVolume(current - step);
  }

  async mute() {
    try {
      const state = parseAudioState(await this._run(`
$volume = [AudioBridge]::GetMasterVolume()
[void][AudioBridge]::SetMute($true)
$muted = [AudioBridge]::GetMute()
Write-Output $muted
Write-Output $volume
`));
      if (!state || state.muted !== true) {
        return this._failure('Mute state did not change', 'volume.mute');
      }

      this._rememberVolume(state.volume, false);
      this.logger.info('Volume muted');
      return this._success('volume.mute', {
        value: 0,
        rawValue: state.volume,
        muted: true,
        verificationCheck: 'volume-muted'
      });
    } catch (error) {
      this.logger.error('Failed to mute volume', error.message);
      return this._failure('Failed to mute system volume', 'volume.mute');
    }
  }

  async unmute() {
    try {
      const restore = clampPercent(this.lastUnmutedVolume || DEFAULT_VOLUME, DEFAULT_VOLUME);
      const state = parseAudioState(await this._run(`
$volume = [AudioBridge]::GetMasterVolume()
if ($volume -le 0) {
  [void][AudioBridge]::SetMasterVolume(${restore})
}
[void][AudioBridge]::SetMute($false)
$muted = [AudioBridge]::GetMute()
$volume = [AudioBridge]::GetMasterVolume()
Write-Output $muted
Write-Output $volume
`));
      if (!state || state.muted !== false) {
        return this._failure('Mute state did not clear', 'volume.unmute');
      }

      this._rememberVolume(state.volume, false);
      return this._success('volume.unmute', {
        value: state.volume,
        rawValue: state.volume,
        muted: false,
        verificationCheck: 'volume-unmuted'
      });
    } catch (error) {
      this.logger.error('Failed to unmute volume', error.message);
      return this._failure('Failed to unmute system volume', 'volume.unmute');
    }
  }

  async _getVolumeBaseline() {
    if (Date.now() - this.lastSetAt <= 1500) {
      return this.lastKnownVolume;
    }
    return this.getCurrentVolume();
  }
}

module.exports = VolumeController;
module.exports._private = {
  clampPercent,
  normalizeStep,
  parseNumber,
  parseBoolean,
  parseAudioState
};
