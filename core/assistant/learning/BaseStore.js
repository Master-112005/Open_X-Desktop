'use strict';

const fs = require('fs');
const path = require('path');
const {
  ensureDirectory,
  readSecureJsonFile,
  writeFileAtomic,
  writeSecureJsonAtomic
} = require('../Data');

const DEFAULT_MAX_BYTES = 1024 * 1024;

function clone(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_) {
    return {};
  }
}

function assertSafeDestination(filePath) {
  if (!path.isAbsolute(filePath)) {
    throw new Error('Learning store path must be absolute');
  }
  if (fs.existsSync(filePath) && fs.lstatSync(filePath).isSymbolicLink()) {
    throw new Error('Refusing to write learning data through a symbolic link');
  }
}

function writeJsonAtomic(filePath, value, options = {}) {
  assertSafeDestination(filePath);
  writeSecureJsonAtomic(filePath, value, {
    spacing: options.spacing,
    backup: options.backup,
    maxBytes: options.maxBytes,
    config: options.config,
    keyPath: options.keyPath
  });
}

function readJsonFile(filePath, fallbackValue = {}, options = {}) {
  assertSafeDestination(filePath);
  return readSecureJsonFile(filePath, fallbackValue, {
    spacing: options.spacing,
    preserveCorrupt: options.preserveCorrupt,
    createIfMissing: options.createIfMissing,
    maxBytes: options.maxBytes,
    validate: options.validate,
    config: options.config,
    keyPath: options.keyPath
  });
}

class BaseStore {
  constructor(filePath, options = {}) {
    this.filePath = path.resolve(String(filePath || '.'));
    this.spacing = Number.isInteger(options.spacing) ? options.spacing : 2;
    this.autoCreate = options.autoCreate !== false;
    this.maxBytes = Number(options.maxBytes) > 0 ? Number(options.maxBytes) : DEFAULT_MAX_BYTES;
    this.config = options.config || {};
    this.keyPath = options.keyPath || null;
    this.lastError = null;
    this.data = this._load();
    this.lastPersistedData = clone(this.data);
  }

  _load() {
    return readJsonFile(this.filePath, () => this.getDefaultData(), {
      spacing: this.spacing,
      preserveCorrupt: true,
      createIfMissing: this.autoCreate,
      maxBytes: this.maxBytes,
      validate: value => this.validateData(value),
      config: this.config,
      keyPath: this.keyPath
    });
  }

  _save(data = this.data) {
    try {
      if (!this.validateData(data)) {
        throw new Error('Refusing to save invalid learning data');
      }
      writeJsonAtomic(this.filePath, data, {
        spacing: this.spacing,
        backup: true,
        maxBytes: this.maxBytes,
        config: this.config,
        keyPath: this.keyPath
      });
      this.data = data;
      this.lastPersistedData = clone(data);
      this.lastError = null;
      return true;
    } catch (err) {
      this.data = clone(this.lastPersistedData);
      this.lastError = err;
      return false;
    }
  }

  validateData(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  getDefaultData() { return {}; }
  getAll() { return clone(this.data); }
  clear() { return this._setData(this.getDefaultData()); }
  _getData() { return this.data; }
  _setData(newData) { return this._save(newData); }

  reload() {
    this.data = this._load();
    this.lastPersistedData = clone(this.data);
    this.lastError = null;
    return this.getAll();
  }

  getFilePath() { return this.filePath; }
  exists() { return fs.existsSync(this.filePath); }
  getLastError() { return this.lastError; }
  getStatus() {
    const stats = this.getFileStats();
    return {
      path: this.filePath,
      exists: this.exists(),
      size: stats?.size || 0,
      modified: stats?.modified || null,
      healthy: !this.lastError,
      lastError: this.lastError ? String(this.lastError.message || this.lastError) : null
    };
  }

  getFileStats() {
    try {
      const stats = fs.statSync(this.filePath);
      return { size: stats.size, created: stats.birthtime, modified: stats.mtime, path: this.filePath };
    } catch (_) {
      return null;
    }
  }
}

module.exports = {
  BaseStore,
  DEFAULT_MAX_BYTES,
  readJsonFile,
  writeJsonAtomic,
  writeFileAtomic,
  ensureDirectory
};
