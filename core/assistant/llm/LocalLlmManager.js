'use strict';

const fs = require('fs');
const path = require('path');
const { ExternalLlmEngine, shouldUseExternalRuntime } = require('./ExternalLlmEngine');
const { createLeakGuard } = require('./LeakGuard');
const { LlamaEngine } = require('./LlamaEngine');
const { buildTurnPrompt } = require('./prompt');

const DEFAULT_MODEL_RELATIVE_PATH = path.join('models', 'Llama-3.2-1B', 'Llama-3.2-1B-Instruct-Q4_K_M.gguf');

function defaultModelPath() {
  const sourcePath = path.join(__dirname, '..', '..', '..', DEFAULT_MODEL_RELATIVE_PATH);
  const candidates = [sourcePath];
  if (process.resourcesPath) {
    candidates.push(
      path.join(process.resourcesPath, DEFAULT_MODEL_RELATIVE_PATH),
      path.join(process.resourcesPath, 'app.asar.unpacked', DEFAULT_MODEL_RELATIVE_PATH)
    );
  }
  return candidates.find(candidate => fs.existsSync(candidate)) || sourcePath;
}

function basename(value) {
  return path.basename(String(value || ''));
}

function resolveModelPath(value) {
  const configured = String(value || '').trim();
  if (!configured) return defaultModelPath();
  if (fs.existsSync(configured)) return configured;

  const candidates = [];
  if (/\.asar(?=\\|\/)/i.test(configured)) {
    candidates.push(configured.replace(/\.asar(?=\\|\/)/i, '.asar.unpacked'));
  }
  if (process.resourcesPath && path.basename(configured) === path.basename(DEFAULT_MODEL_RELATIVE_PATH)) {
    candidates.push(
      path.join(process.resourcesPath, DEFAULT_MODEL_RELATIVE_PATH),
      path.join(process.resourcesPath, 'app.asar.unpacked', DEFAULT_MODEL_RELATIVE_PATH)
    );
  }
  return candidates.find(candidate => fs.existsSync(candidate)) || configured;
}

function formatLoggerData(data = {}) {
  return Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${value}`)
    .join(' | ');
}

function log(logger, level, message, data = {}) {
  const details = formatLoggerData(data);
  const text = details ? `${message} | ${details}` : message;
  if (typeof logger?.[level] === 'function') {
    logger[level](text);
  }
}

class LocalLlmManager {
  constructor(config = {}, dependencies = {}) {
    this.config = config || {};
    this.logger = dependencies.logger || console;
    this.engineFactory = dependencies.engineFactory || null;
    this.engine = null;
    this.loadPromise = null;
    this.status = 'unloaded';
    this.lastError = null;
  }

  getSettings() {
    const assistantSettings = this.config?.assistant?.localLlm || {};
    const rootSettings = this.config?.localLlm || {};
    return {
      enabled: rootSettings.enabled ?? assistantSettings.enabled ?? true,
      modelPath: resolveModelPath(rootSettings.modelPath || assistantSettings.modelPath || defaultModelPath()),
      contextMin: rootSettings.contextMin || assistantSettings.contextMin,
      contextMax: rootSettings.contextMax || assistantSettings.contextMax,
      maxReplyTokens: rootSettings.maxReplyTokens || assistantSettings.maxReplyTokens,
      loadTimeoutMs: rootSettings.loadTimeoutMs || assistantSettings.loadTimeoutMs,
      requestTimeoutMs: rootSettings.requestTimeoutMs || assistantSettings.requestTimeoutMs,
      nodePath: rootSettings.nodePath || assistantSettings.nodePath,
      runtime: rootSettings.runtime || assistantSettings.runtime || 'auto',
      warmupOnStartup: rootSettings.warmupOnStartup ?? assistantSettings.warmupOnStartup ?? false,
      responseStyle: rootSettings.responseStyle || assistantSettings.responseStyle || 'concise',
      language: rootSettings.language || assistantSettings.language || 'system'
    };
  }

  isEnabled() {
    return this.getSettings().enabled !== false;
  }

  validate() {
    const settings = this.getSettings();
    if (!settings.enabled) {
      return { success: false, reason: 'disabled' };
    }
    if (!settings.modelPath || !fs.existsSync(settings.modelPath)) {
      return { success: false, reason: 'missing-model', modelPath: settings.modelPath };
    }
    const stat = fs.statSync(settings.modelPath);
    if (!stat.isFile() || stat.size <= 0) {
      return { success: false, reason: 'invalid-model', modelPath: settings.modelPath };
    }
    return {
      success: true,
      modelPath: settings.modelPath,
      modelName: basename(settings.modelPath),
      size: stat.size
    };
  }

  async getEngine(options = {}) {
    if (this.engine) {
      return this.engine;
    }
    if (this.loadPromise) {
      return this.loadPromise;
    }

    const settings = this.getSettings();
    const validation = this.validate();
    if (!validation.success) {
      throw new Error(`Local LLM model is not available: ${validation.reason}`);
    }
    const externalRuntime = shouldUseExternalRuntime(settings);
    const startedAt = Date.now();
    log(this.logger, 'info', '[LLM] Local LLM loading started', {
      runtime: externalRuntime ? 'external-node-worker' : 'in-process',
      model: validation.modelName,
      size: validation.size
    });
    this.status = 'loading';
    this.lastError = null;
    this.loadPromise = Promise.resolve()
      .then(() => {
        const createEngine = this.engineFactory || (engineOptions => {
          if (externalRuntime) {
            return ExternalLlmEngine.create(engineOptions);
          }
          return LlamaEngine.create(engineOptions);
        });
        return createEngine({
          modelPath: settings.modelPath,
          contextMin: settings.contextMin,
          contextMax: settings.contextMax,
          maxReplyTokens: settings.maxReplyTokens,
          loadTimeoutMs: settings.loadTimeoutMs,
          requestTimeoutMs: settings.requestTimeoutMs,
          nodePath: settings.nodePath,
          runtime: settings.runtime,
          memorySummary: options.memorySummary || '',
          assistantName: options.assistantName || this.config?.assistant?.displayName || 'OpenX',
          responseStyle: options.responseStyle || settings.responseStyle,
          language: options.language || settings.language
        });
      })
      .then(engine => {
        this.engine = engine;
        this.status = 'ready';
        log(this.logger, 'info', '[LLM] Local LLM ready', {
          runtime: externalRuntime ? 'external-node-worker' : 'in-process',
          model: validation.modelName,
          loadMs: Date.now() - startedAt
        });
        return engine;
      })
      .catch(error => {
        this.status = 'failed';
        this.lastError = error?.message || String(error);
        log(this.logger, 'warn', '[LLM] Local LLM loading failed', {
          error: this.lastError
        });
        throw error;
      })
      .finally(() => {
        this.loadPromise = null;
      });

    return this.loadPromise;
  }

  async reply(userText, options = {}) {
    const validation = this.validate();
    if (!validation.success) {
      log(this.logger, 'warn', '[LLM] Local LLM reply skipped', {
        reason: validation.reason,
        modelPath: validation.modelPath
      });
      return {
        success: false,
        error: validation.reason,
        data: { localLlm: validation }
      };
    }

    const leakGuard = createLeakGuard(options.onToken);
    const engine = await this.getEngine(options);
    const startedAt = Date.now();
    log(this.logger, 'info', '[LLM] Local LLM reply started', {
      source: options.source || 'assistant',
      model: validation.modelName
    });
    const turnPrompt = buildTurnPrompt(userText, {
      memorySummary: options.memorySummary || '',
      conversationSummary: options.conversationSummary || '',
      now: options.now
    });
    const result = await engine.reply(turnPrompt, chunk => leakGuard.feed(chunk));
    const response = leakGuard.finalize(result?.text || '');
    log(this.logger, 'info', '[LLM] Local LLM reply completed', {
      model: validation.modelName,
      totalMs: result?.timings?.totalMs || Date.now() - startedAt,
      responseChars: response.length
    });

    return {
      success: Boolean(response),
      response,
      data: {
        localLlm: {
          status: this.status,
          modelName: validation.modelName,
          timings: result?.timings || null
        }
      }
    };
  }

  getStatus() {
    const validation = this.validate();
    return {
      enabled: this.isEnabled(),
      status: this.status,
      lastError: this.lastError,
      modelName: validation.modelName || basename(validation.modelPath),
      modelReady: validation.success
    };
  }

  async invalidate() {
    const engine = this.engine;
    this.engine = null;
    this.status = 'unloaded';
    if (engine?.dispose) {
      await engine.dispose();
    }
  }
}

function createDefaultLocalLlmManager(config, dependencies = {}) {
  return new LocalLlmManager(config, dependencies);
}

module.exports = {
  LocalLlmManager,
  createDefaultLocalLlmManager,
  defaultModelPath,
  resolveModelPath
};
