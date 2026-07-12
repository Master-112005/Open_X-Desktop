const STATES = require('./DownloadState');
const EVENTS = require('./DownloadEvents');
const TransferResult = require('./TransferResult');
const DownloadWorker = require('./DownloadWorker');
const RetryManager = require('./RetryManager');

function delay(ms) {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}

class DownloadEngine {
  constructor(options = {}) {
    this.configuration = options.configuration;
    this.validator = options.validator;
    this.storage = options.storage;
    this.logger = options.logger;
    this.emitEvent = options.emitEvent || (() => {});
    this.retryManager = options.retryManager || new RetryManager({
      maxRetries: this.configuration.maxRetries,
      retryDelayMs: this.configuration.retryDelayMs
    });
    this.worker = options.worker || new DownloadWorker({
      configuration: this.configuration,
      validator: this.validator,
      storage: this.storage,
      logger: this.logger,
      emitEvent: this.emitEvent
    });
  }

  async download(task, options = {}) {
    let resume = options.resume === true;
    let attempts = 0;
    while (attempts <= this.retryManager.maxRetries + 1) {
      attempts += 1;
      const result = await this.worker.run(task, { resume });
      if (result.success || [STATES.PAUSED, STATES.CANCELLED, STATES.COMPLETED].includes(task.state)) {
        return result;
      }
      const error = result.error || new Error('Download failed');
      if (!this.retryManager.canRetry(error, task.retryCount)) {
        task.failureReason = error.message || 'Download failed';
        task.setState(STATES.FAILED);
        this.storage.writeMetadata(task);
        this.emitEvent(EVENTS.DOWNLOAD_FAILED, task.snapshot());
        return TransferResult.fail('download.failed', error, task.snapshot());
      }
      const delayMs = this.retryManager.getDelay(task.retryCount);
      task.retryCount += 1;
      task.statistics.retries = task.retryCount;
      task.setState(STATES.RETRYING);
      this.storage.writeMetadata(task);
      this.emitEvent(EVENTS.DOWNLOAD_RETRY, { ...task.snapshot(), delayMs });
      await delay(delayMs);
      resume = true;
    }
    const error = new Error('Download retry limit exceeded.');
    error.code = 'RETRY_LIMIT_EXCEEDED';
    return TransferResult.fail('download.failed', error, task.snapshot());
  }

  pause(task) {
    if (!task) return false;
    task.setState(STATES.PAUSED);
    task.controller?.abort?.();
    return true;
  }

  cancel(task) {
    if (!task) return false;
    task.setState(STATES.CANCELLED);
    task.controller?.abort?.();
    return true;
  }
}

module.exports = DownloadEngine;
