'use strict';

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { MODEL_IDS } = require('../contracts/VisionContracts');

const SCRIPT_PATH = path.join(__dirname, 'windows-face-analysis.ps1');
const SUPPORTED_MODELS = new Set([MODEL_IDS.SCRFD, MODEL_IDS.MOBILE_FACE_NET]);

class WindowsFaceRuntimeAdapter {
  constructor(options = {}) {
    this.scriptPath = options.scriptPath || SCRIPT_PATH;
    this.timeoutMs = Math.max(3000, Number(options.timeoutMs || 20000));
    this.maxCacheEntries = Math.max(10, Number(options.maxCacheEntries || 200));
    this.logger = options.logger || null;
    this.cache = new Map();
    this.failureCache = new Map();
    this.loggedSessions = new Set();
  }

  async createSession(model) {
    if (process.platform !== 'win32') {
      const error = new Error('Windows face analysis is only available on Windows.');
      error.code = 'vision.windows_face_unavailable';
      this._warn('Windows face analysis is not available on this operating system.', { platform: process.platform });
      throw error;
    }
    if (!SUPPORTED_MODELS.has(model?.id)) {
      const error = new Error(`Windows face analysis cannot run model ${model?.id || 'unknown'}.`);
      error.code = 'vision.model_not_supported_by_windows_face_adapter';
      this._warn('Windows face analysis cannot run the requested vision model.', { model: model?.id || 'unknown' });
      throw error;
    }
    if (!fs.existsSync(this.scriptPath)) {
      const error = new Error('Windows face analysis script is missing.');
      error.code = 'vision.windows_face_script_missing';
      this._warn('Windows face analysis script is missing.', { scriptPath: this.scriptPath });
      throw error;
    }
    if (!this.loggedSessions.has(model.id)) {
      this.loggedSessions.add(model.id);
      this._info('Windows face analysis model ready.', {
        modelId: model.id,
        model: this._modelLabel(model.id),
        role: this._modelRole(model.id),
        runtime: 'windows-face-analysis',
        timeoutMs: this.timeoutMs
      });
    }
    return new WindowsFaceRuntimeSession({
      model,
      adapter: this
    });
  }

  async analyze(imagePath) {
    const normalizedPath = path.resolve(String(imagePath || ''));
    if (!normalizedPath || !fs.existsSync(normalizedPath)) {
      const error = new Error('Image path is not available for Windows face analysis.');
      error.code = 'vision.image_path_unavailable';
      throw error;
    }

    const stat = fs.statSync(normalizedPath);
    const cacheKey = `${normalizedPath}:${stat.mtimeMs}:${stat.size}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this._debug('Using cached face analysis result.', { image: path.basename(normalizedPath) });
      return cached;
    }
    const cachedFailure = this.failureCache.get(cacheKey);
    if (cachedFailure) {
      this._debug('Skipping duplicate face analysis after a recent failure.', {
        image: path.basename(normalizedPath),
        code: cachedFailure.code
      });
      throw this._rehydrateError(cachedFailure);
    }

    this._debug('Checking image for faces with Windows face analysis.', { image: path.basename(normalizedPath) });
    try {
      const result = await this._runScript(normalizedPath);
      const faceCount = Array.isArray(result.faces) ? result.faces.length : 0;
      const embeddingCount = Array.isArray(result.embeddings) ? result.embeddings.length : 0;
      if (faceCount > 0 || embeddingCount > 0) {
        this._debug('Windows face analysis completed for image.', {
          image: path.basename(normalizedPath),
          faces: faceCount,
          embeddings: embeddingCount
        });
      }
      this._remember(cacheKey, result);
      this.failureCache.delete(cacheKey);
      return result;
    } catch (error) {
      this._rememberFailure(cacheKey, error);
      throw error;
    }
  }

  _remember(key, value) {
    this.cache.set(key, value);
    while (this.cache.size > this.maxCacheEntries) {
      this.cache.delete(this.cache.keys().next().value);
    }
  }

  _rememberFailure(key, error) {
    this.failureCache.set(key, {
      name: error?.name || 'Error',
      message: error?.message || String(error || 'Windows face analysis failed.'),
      code: error?.code || 'vision.windows_face_failed'
    });
    while (this.failureCache.size > this.maxCacheEntries) {
      this.failureCache.delete(this.failureCache.keys().next().value);
    }
  }

  _rehydrateError(serialized = {}) {
    const error = new Error(serialized.message || 'Windows face analysis failed.');
    error.name = serialized.name || 'Error';
    error.code = serialized.code || 'vision.windows_face_failed';
    return error;
  }

  _runScript(imagePath) {
    return new Promise((resolve, reject) => {
      execFile('powershell.exe', [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        this.scriptPath,
        '-ImagePath',
        imagePath
      ], {
        windowsHide: true,
        timeout: this.timeoutMs,
        maxBuffer: 1024 * 1024 * 6
      }, (error, stdout, stderr) => {
        if (error) {
          const wrapped = new Error((stderr || error.message || '').trim() || 'Windows face analysis failed.');
          wrapped.code = error.killed ? 'vision.windows_face_timeout' : 'vision.windows_face_failed';
          this._warn('Windows face analysis could not finish for this image.', {
            image: path.basename(imagePath),
            code: wrapped.code,
            error: wrapped.message
          });
          reject(wrapped);
          return;
        }
        try {
          const line = String(stdout || '')
            .split(/\r?\n/)
            .map(item => item.trim())
            .reverse()
            .find(item => item.startsWith('{') && item.endsWith('}'));
          if (!line) {
            const parseError = new Error('Windows face analysis did not return JSON.');
            parseError.code = 'vision.windows_face_no_output';
            this._warn('Windows face analysis returned no readable result.', { image: path.basename(imagePath) });
            reject(parseError);
            return;
          }
          const parsed = JSON.parse(line);
          if (parsed.success === false) {
            const unavailable = new Error(parsed.reason || 'Windows face analysis is unavailable.');
            unavailable.code = parsed.reason || 'vision.windows_face_unavailable';
            this._warn('Windows face analysis reported that it is unavailable.', {
              image: path.basename(imagePath),
              reason: unavailable.code
            });
            reject(unavailable);
            return;
          }
          resolve(parsed);
        } catch (parseError) {
          parseError.code = parseError.code || 'vision.windows_face_parse_failed';
          this._warn('Windows face analysis result could not be parsed.', {
            image: path.basename(imagePath),
            code: parseError.code,
            error: parseError.message
          });
          reject(parseError);
        }
      });
    });
  }

  _info(message, data = {}) {
    this.logger?.info?.(`[Windows Face] ${message}`, data);
  }

  _warn(message, data = {}) {
    this.logger?.warn?.(`[Windows Face] ${message}`, data);
  }

  _debug(message, data = {}) {
    this.logger?.debug?.(`[Windows Face] ${message}`, data);
  }

  _modelLabel(modelId = '') {
    if (modelId === MODEL_IDS.SCRFD) return 'SCRFD face detector';
    if (modelId === MODEL_IDS.MOBILE_FACE_NET) return 'MobileFaceNet face recognition embeddings';
    return String(modelId || 'Unknown vision model');
  }

  _modelRole(modelId = '') {
    if (modelId === MODEL_IDS.SCRFD) return 'face detection';
    if (modelId === MODEL_IDS.MOBILE_FACE_NET) return 'face recognition embeddings';
    return 'vision inference';
  }
}

class WindowsFaceRuntimeSession {
  constructor({ model, adapter } = {}) {
    this.model = model;
    this.adapter = adapter;
  }

  async run(input = {}, options = {}) {
    const analysis = await this.adapter.analyze(input.imagePath);
    const task = options.task || '';
    if (this.model.id === MODEL_IDS.SCRFD || task === 'faces') {
      return {
        faces: Array.isArray(analysis.faces) ? analysis.faces : [],
        confidence: this._confidence(analysis.faces)
      };
    }
    if (this.model.id === MODEL_IDS.MOBILE_FACE_NET || task === 'faceEmbedding') {
      return {
        embeddings: Array.isArray(analysis.embeddings) ? analysis.embeddings : [],
        confidence: this._confidence(analysis.embeddings)
      };
    }
    return { confidence: 0 };
  }

  _confidence(items = []) {
    if (!Array.isArray(items) || items.length === 0) return 0;
    return items.reduce((best, item) => Math.max(best, Number(item.confidence || 0)), 0);
  }

  async dispose() {}
}

module.exports = WindowsFaceRuntimeAdapter;
