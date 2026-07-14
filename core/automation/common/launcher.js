const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_TARGET_LENGTH = 4096;
const MAX_ARGUMENTS = 64;
const MAX_ARGUMENT_LENGTH = 4096;
const MAX_TOTAL_ARGUMENT_LENGTH = 24000;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;
const POWERSHELL_EXECUTABLE = 'powershell.exe';

function escapePowerShell(value) {
  return String(value ?? '').replace(/'/g, "''");
}

function normalizeTarget(target) {
  const safeTarget = String(target ?? '').trim();
  if (!safeTarget) {
    throw new Error('No target provided');
  }
  if (safeTarget.length > MAX_TARGET_LENGTH) {
    throw new Error('Launch target is too long');
  }
  if (CONTROL_CHARACTER_PATTERN.test(safeTarget)) {
    throw new Error('Launch target contains unsupported control characters');
  }
  return safeTarget;
}

function normalizeArguments(args = []) {
  if (args === undefined || args === null) {
    return [];
  }
  if (!Array.isArray(args)) {
    throw new Error('Launch arguments must be an array');
  }
  if (args.length > MAX_ARGUMENTS) {
    throw new Error(`Launch argument count cannot exceed ${MAX_ARGUMENTS}`);
  }

  let totalLength = 0;
  return args.map(arg => {
    const value = String(arg ?? '');
    if (CONTROL_CHARACTER_PATTERN.test(value)) {
      throw new Error('Launch argument contains unsupported control characters');
    }
    if (value.length > MAX_ARGUMENT_LENGTH) {
      throw new Error('Launch argument is too long');
    }
    totalLength += value.length;
    if (totalLength > MAX_TOTAL_ARGUMENT_LENGTH) {
      throw new Error('Launch argument list is too long');
    }
    return value;
  });
}

function classifyTarget(target) {
  if (path.isAbsolute(target)) {
    return path.extname(target).toLowerCase() === '.exe' && fs.existsSync(target)
      ? 'executable-path'
      : 'absolute-path';
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) {
    return 'uri';
  }
  if (/^[\w .!{}-]+![\w .!{}-]+$/i.test(target)) {
    return 'app-user-model-id';
  }
  return 'command-or-shell-target';
}

function buildArgumentClause(args = []) {
  if (!Array.isArray(args) || args.length === 0) {
    return '';
  }

  const serializedArgs = args.map(arg => `'${escapePowerShell(arg)}'`).join(', ');
  return ` -ArgumentList ${serializedArgs}`;
}

function buildStartProcessScript(target, args = []) {
  return `Start-Process -FilePath '${escapePowerShell(target)}'${buildArgumentClause(args)}`;
}

function spawnExecutable(target, args = []) {
  const child = spawn(target, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: false
  });
  child.once('error', () => {
    // Detached launches are verified by higher layers; avoid an unhandled async error.
  });
  child.unref();
  return child;
}

function startProcess(target, args = [], options = {}) {
  const script = buildStartProcessScript(target, args);
  execFileSync(POWERSHELL_EXECUTABLE, [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    script
  ], {
    timeout: Number.isFinite(options.timeoutMs) ? options.timeoutMs : DEFAULT_TIMEOUT_MS,
    stdio: 'ignore',
    windowsHide: true
  });
}

function launchTarget(target, args = [], options = {}) {
  const safeTarget = normalizeTarget(target);
  const safeArgs = normalizeArguments(args);
  const classification = classifyTarget(safeTarget);

  if (classification === 'executable-path') {
    const child = spawnExecutable(safeTarget, safeArgs);
    return {
      success: true,
      method: 'spawn',
      target: safeTarget,
      args: safeArgs,
      pid: Number.isFinite(child.pid) ? child.pid : null,
      classification
    };
  }

  startProcess(safeTarget, safeArgs, options);
  return {
    success: true,
    method: 'powershell-start-process',
    target: safeTarget,
    args: safeArgs,
    classification
  };
}

module.exports = {
  launchTarget,
  _private: {
    buildArgumentClause,
    buildStartProcessScript,
    classifyTarget,
    escapePowerShell,
    normalizeArguments,
    normalizeTarget
  }
};
