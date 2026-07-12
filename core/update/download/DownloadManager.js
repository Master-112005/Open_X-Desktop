const EventEmitter = require('events');
const fs = require('fs');
const STATES = require('./DownloadState');
const EVENTS = require('./DownloadEvents');
const TransferResult = require('./TransferResult');
const { DownloadConfiguration } = require('./DownloadConfiguration');
const DownloadLogger = require('./DownloadLogger');
const DownloadDiagnostics = require('./DownloadDiagnostics');
const DownloadQueue = require('./DownloadQueue');
const DownloadTask = require('./DownloadTask');
const DownloadStorage = require('./DownloadStorage');
const TransferValidator = require('./TransferValidator');
const DownloadEngine = require('./DownloadEngine');
const DownloadScheduler = require('./DownloadScheduler');
const BackgroundTransferManager = require('./BackgroundTransferManager');

class DownloadManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.configuration = options.configuration instanceof DownloadConfiguration
      ? options.configuration
      : new DownloadConfiguration(options.download || options.configuration || {});
    this.logger = options.downloadLogger || new DownloadLogger({
      logger: options.logger,
      enabled: this.configuration.loggingEnabled
    });
    this.diagnostics = options.diagnostics || new DownloadDiagnostics({
      enabled: this.configuration.diagnosticsEnabled
    });
    this.directories = options.directories || {};
    this.storage = options.storage || new DownloadStorage({
      downloadsDir: this.directories.downloadsDir,
      cacheDir: this.directories.cacheDir
    });
    this.validator = options.validator || new TransferValidator({ configuration: this.configuration });
    this.queue = options.queue || new DownloadQueue();
    this.scheduler = options.scheduler || new DownloadScheduler({ maxActive: this.configuration.maxSimultaneousDownloads });
    this.backgroundTransfers = options.backgroundTransfers || new BackgroundTransferManager();
    this.engine = options.engine || new DownloadEngine({
      configuration: this.configuration,
      validator: this.validator,
      storage: this.storage,
      logger: this.logger,
      emitEvent: (event, payload) => this._emitDownloadEvent(event, payload)
    });
    this.tasks = new Map();
    this.history = [];
    this.initialized = false;
  }

  initialize(directories = this.directories) {
    this.directories = directories || this.directories;
    this.storage.downloadsDir = this.directories.downloadsDir;
    this.storage.cacheDir = this.directories.cacheDir;
    this.storage.ensure();
    this.initialized = true;
    if (this.configuration.autoResume) this.loadPersistedSessions();
    return TransferResult.ok('download.initialized', this.getStatus());
  }

  createDownload(input = {}) {
    if (!this.configuration.enabled) return TransferResult.fail('download.disabled', new Error('Downloads are disabled.'));
    const validation = this.validator.validateRequest(input);
    if (!validation.success) return TransferResult.fail('download.invalid', validation.error);
    const task = new DownloadTask({ ...input, url: validation.url, state: STATES.QUEUED });
    const paths = this.storage.buildPaths(task);
    task.fileName = paths.fileName;
    task.destinationPath = paths.destinationPath;
    task.partPath = paths.partPath;
    task.metadataPath = paths.metadataPath;
    this.tasks.set(task.id, task);
    this.queue.enqueue(task);
    this.storage.writeMetadata(task);
    this.diagnostics.mark('downloadCount');
    this._emitDownloadEvent(EVENTS.DOWNLOAD_CREATED, task.snapshot());
    return TransferResult.ok('download.created', task.snapshot());
  }

  async startDownload(input = {}) {
    if (!this.initialized) this.initialize();
    const created = input.id && this.tasks.has(input.id)
      ? TransferResult.ok('download.existing', this.tasks.get(input.id).snapshot())
      : this.createDownload(input);
    if (!created.success) return created;
    const task = this.tasks.get(created.data.id);
    return this._startTask(task, { resume: input.resume === true });
  }

  async _startTask(task, options = {}) {
    if (!task) return TransferResult.fail('download.missing', new Error('Download task not found.'));
    if (!this.scheduler.canStart(this.backgroundTransfers.list().length)) {
      task.setState(STATES.QUEUED);
      return TransferResult.ok('download.queued', task.snapshot());
    }
    this.backgroundTransfers.track(task);
    this.logger.info('Download started', { id: task.id, fileName: task.fileName });
    const result = await this.engine.download(task, options);
    this.backgroundTransfers.untrack(task.id);
    this.diagnostics.updateProgress(task.snapshot());
    if ([STATES.COMPLETED, STATES.FAILED, STATES.CANCELLED].includes(task.state)) {
      this.history.unshift(task.snapshot());
      this.history = this.history.slice(0, 100);
    }
    return result;
  }

  pauseDownload(taskId) {
    const task = this.tasks.get(String(taskId || '').trim());
    const paused = this.engine.pause(task);
    if (paused) {
      this.storage.writeMetadata(task);
      this._emitDownloadEvent(EVENTS.DOWNLOAD_PAUSED, task.snapshot());
    }
    return paused ? TransferResult.ok('download.paused', task.snapshot()) : TransferResult.fail('download.pause.failed', new Error('Download task not found.'));
  }

  async resumeDownload(taskId) {
    const task = this.tasks.get(String(taskId || '').trim()) || this.loadTaskById(taskId);
    if (!task) return TransferResult.fail('download.resume.failed', new Error('Download task not found.'));
    task.setState(STATES.RESUMING);
    this._emitDownloadEvent(EVENTS.DOWNLOAD_RESUMED, task.snapshot());
    this.diagnostics.mark('resumeCount');
    return this._startTask(task, { resume: true });
  }

  cancelDownload(taskId) {
    const task = this.tasks.get(String(taskId || '').trim());
    const cancelled = this.engine.cancel(task);
    if (cancelled) {
      this.diagnostics.mark('cancelledCount');
      this.storage.writeMetadata(task);
      this._emitDownloadEvent(EVENTS.DOWNLOAD_CANCELLED, task.snapshot());
    }
    return cancelled ? TransferResult.ok('download.cancelled', task.snapshot()) : TransferResult.fail('download.cancel.failed', new Error('Download task not found.'));
  }

  shutdown() {
    for (const task of this.backgroundTransfers.list()) {
      task.setState(STATES.PAUSED);
      task.controller?.abort?.();
      this.storage.writeMetadata(task);
    }
    return TransferResult.ok('download.shutdown', this.getStatus());
  }

  removeDownload(taskId) {
    const task = this.tasks.get(String(taskId || '').trim()) || this.loadTaskById(taskId);
    if (!task) return TransferResult.fail('download.remove.failed', new Error('Download task not found.'));
    if (![STATES.COMPLETED, STATES.FAILED, STATES.CANCELLED, STATES.PAUSED].includes(task.state)) {
      return TransferResult.fail('download.remove.failed', new Error('Download is active.'));
    }
    this.tasks.delete(task.id);
    this.queue.remove(task.id);
    fs.rmSync(task.metadataPath, { force: true });
    return TransferResult.ok('download.removed', { id: task.id });
  }

  getTask(taskId) {
    return this.tasks.get(String(taskId || '').trim()) || this.loadTaskById(taskId);
  }

  getStatus(taskId = '') {
    if (taskId) return this.getTask(taskId)?.snapshot() || null;
    return {
      initialized: this.initialized,
      configuration: this.configuration.toJSON(),
      directories: { ...this.directories },
      active: this.backgroundTransfers.list().map(task => task.snapshot()),
      queued: this.queue.list().map(task => task.snapshot()),
      tasks: Array.from(this.tasks.values()).map(task => task.snapshot()),
      history: this.history.slice()
    };
  }

  getDiagnostics() {
    return this.diagnostics.snapshot(this.getStatus());
  }

  loadTaskById(taskId) {
    const id = String(taskId || '').trim();
    if (!id || !this.storage.cacheDir) return null;
    const metadataPath = `${this.storage.cacheDir}/${id}.json`;
    const metadata = this.storage.readMetadata(metadataPath);
    if (!metadata) return null;
    const task = new DownloadTask(metadata);
    this.tasks.set(task.id, task);
    return task;
  }

  loadPersistedSessions() {
    try {
      for (const entry of fs.readdirSync(this.storage.cacheDir)) {
        if (!entry.endsWith('.json')) continue;
        const metadata = this.storage.readMetadata(`${this.storage.cacheDir}/${entry}`);
        if (!metadata?.id) continue;
        const task = new DownloadTask(metadata);
        if (![STATES.COMPLETED, STATES.CANCELLED].includes(task.state)) {
          task.setState(STATES.PAUSED);
          this.tasks.set(task.id, task);
        }
      }
    } catch (_) {}
  }

  _emitDownloadEvent(event, payload) {
    this.diagnostics.updateProgress(payload || {});
    if (event === EVENTS.DOWNLOAD_RETRY) this.diagnostics.mark('retries');
    if (event === EVENTS.DOWNLOAD_FAILED) this.diagnostics.recordError(new Error(payload?.failureReason || 'Download failed'));
    this.emit(event, payload);
    this.emit(EVENTS.STATE_CHANGED, payload);
  }
}

module.exports = DownloadManager;
