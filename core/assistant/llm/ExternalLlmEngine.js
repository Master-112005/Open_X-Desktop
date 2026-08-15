'use strict';

const { fork } = require('child_process');
const path = require('path');

const DEFAULT_REQUEST_TIMEOUT_MS = 120000;

function nodeMajor() {
  return Number(String(process.versions?.node || '0').split('.')[0]) || 0;
}

function isElectronRuntime() {
  return Boolean(process.versions?.electron);
}

function shouldUseExternalRuntime(settings = {}) {
  const runtime = String(settings.runtime || 'auto').toLowerCase();
  if (runtime === 'external' || runtime === 'worker') return true;
  if (runtime === 'direct' || runtime === 'in-process') return false;
  return isElectronRuntime() && nodeMajor() < 20;
}

function resolveNodeExecutable(settings = {}) {
  return settings.nodePath ||
    process.env.OPENX_LLM_NODE_PATH ||
    process.env.npm_node_execpath ||
    process.env.NODE ||
    'node';
}

class ExternalLlmEngine {
  constructor(child, options = {}) {
    this.child = child;
    this.pending = new Map();
    this.nextId = 1;
    this.requestTimeoutMs = Math.max(1000, Number(options.requestTimeoutMs) || DEFAULT_REQUEST_TIMEOUT_MS);
    this.disposed = false;

    child.on('message', message => this._handleMessage(message));
    child.on('exit', (code, signal) => this._rejectAll(new Error(`LLM worker exited (${code ?? signal ?? 'unknown'})`)));
    child.on('error', error => this._rejectAll(error));
  }

  static async create(options = {}) {
    const workerPath = path.join(__dirname, 'llm-worker.js');
    const child = fork(workerPath, [], {
      execPath: resolveNodeExecutable(options),
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1'
      },
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      windowsHide: true
    });
    const engine = new ExternalLlmEngine(child, options);
    await engine._request('init', { options }, { timeoutMs: Math.max(1000, Number(options.loadTimeoutMs) || 180000) });
    return engine;
  }

  async reply(userText, onToken) {
    return this._request('reply', { userText }, { onToken });
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    try {
      await this._request('dispose', {}, { timeoutMs: 5000 });
    } catch (_) {
      // The process may already be gone; killing below is enough.
    }
    if (!this.child.killed) {
      this.child.kill();
    }
  }

  _request(type, payload = {}, options = {}) {
    if (this.disposed && type !== 'dispose') {
      return Promise.reject(new Error('LLM worker is disposed'));
    }
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`LLM worker ${type} timed out`));
      }, Math.max(1000, Number(options.timeoutMs) || this.requestTimeoutMs));
      this.pending.set(id, {
        resolve,
        reject,
        onToken: options.onToken,
        timeout
      });
      this.child.send({ id, type, ...payload }, error => {
        if (!error) return;
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(error);
      });
    });
  }

  _handleMessage(message = {}) {
    const pending = this.pending.get(message.id);
    if (!pending) return;

    if (message.type === 'chunk') {
      if (typeof pending.onToken === 'function') {
        pending.onToken(String(message.chunk || ''));
      }
      return;
    }

    clearTimeout(pending.timeout);
    this.pending.delete(message.id);
    if (message.type === 'error') {
      pending.reject(new Error(message.error || 'LLM worker error'));
      return;
    }
    pending.resolve(message.result);
  }

  _rejectAll(error) {
    for (const [id, pending] of this.pending.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.pending.delete(id);
    }
  }
}

module.exports = {
  ExternalLlmEngine,
  nodeMajor,
  resolveNodeExecutable,
  shouldUseExternalRuntime
};
