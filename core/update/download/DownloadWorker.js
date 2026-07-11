const http = require('http');
const https = require('https');
const fs = require('fs');
const STATES = require('./DownloadState');
const EVENTS = require('./DownloadEvents');
const TransferResult = require('./TransferResult');
const FileWriter = require('./FileWriter');
const ChunkReceiver = require('./ChunkReceiver');
const DownloadSpeedMonitor = require('./DownloadSpeedMonitor');
const ETAEstimator = require('./ETAEstimator');
const ResumeManager = require('./ResumeManager');

class DownloadWorker {
  constructor(options = {}) {
    this.configuration = options.configuration;
    this.validator = options.validator;
    this.storage = options.storage;
    this.logger = options.logger;
    this.emitEvent = options.emitEvent || (() => {});
    this.resumeManager = options.resumeManager || new ResumeManager();
  }

  async run(task, options = {}) {
    const resume = options.resume === true;
    const resumeFrom = resume ? this.resumeManager.getResumeOffset(task) : 0;
    if (resumeFrom > 0) {
      task.currentBytes = resumeFrom;
      task.resumeCount += 1;
    }
    const parsed = new URL(task.url);
    const client = parsed.protocol === 'https:' ? https : http;
    const controller = new AbortController();
    task.controller = controller;
    task.setState(resumeFrom > 0 ? STATES.RESUMING : STATES.CONNECTING);
    this.emitEvent(EVENTS.STATE_CHANGED, task.snapshot());

    const headers = {};
    if (resumeFrom > 0) headers.Range = `bytes=${resumeFrom}-`;
    const requestOptions = {
      method: 'GET',
      headers,
      signal: controller.signal,
      timeout: this.configuration.timeoutMs
    };

    return new Promise(resolve => {
      const startedAt = Date.now();
      let responseStarted = false;
      const request = client.request(parsed, requestOptions, async response => {
        responseStarted = true;
        const latencyMs = Date.now() - startedAt;
        const validation = this.validator.validateResponse(response, { resumeFrom });
        if (!validation.success) {
          response.resume();
          resolve(TransferResult.fail('download.response.invalid', validation.error, task.snapshot()));
          return;
        }

        if (resumeFrom > 0 && response.statusCode === 200) {
          try { fs.rmSync(task.partPath, { force: true }); } catch (_) {}
          task.currentBytes = 0;
        }
        task.totalBytes = validation.contentLength + task.currentBytes;
        task.startedAt = task.startedAt || new Date().toISOString();
        task.setState(STATES.DOWNLOADING);
        task.statistics.networkLatencyMs = latencyMs;
        this.emitEvent(EVENTS.DOWNLOAD_STARTED, task.snapshot());

        const writer = new FileWriter({ partPath: task.partPath, resumeFrom: task.currentBytes });
        writer.open();
        const speed = new DownloadSpeedMonitor();
        const eta = new ETAEstimator();
        const receiver = new ChunkReceiver({
          onChunk: async chunk => {
            if (task.state === STATES.PAUSED || task.state === STATES.CANCELLED) {
              const error = new Error(task.state);
              error.code = task.state;
              throw error;
            }
            await writer.write(chunk);
            task.currentBytes += chunk.length;
            const speeds = speed.sample(task.currentBytes);
            task.statistics.currentSpeed = speeds.currentSpeed;
            task.statistics.averageSpeed = speeds.averageSpeed;
            task.statistics.peakSpeed = speeds.peakSpeed;
            task.statistics.minimumSpeed = speeds.minimumSpeed;
            task.statistics.etaMs = eta.estimate(task.currentBytes, task.totalBytes, speeds.rollingAverage);
            task.statistics.bytesDownloaded = task.currentBytes;
            task.statistics.diskWriteTimeMs = writer.diskWriteTimeMs;
            this.storage.writeMetadata(task);
            this.emitEvent(EVENTS.SPEED_UPDATED, task.snapshot());
            this.emitEvent(EVENTS.ETA_UPDATED, task.snapshot());
            this.emitEvent(EVENTS.DOWNLOAD_PROGRESS, task.snapshot());
          }
        });

        try {
          await receiver.receive(response);
          await writer.close();
          task.completedAt = new Date().toISOString();
          task.setState(STATES.COMPLETED);
          writer.complete(task.destinationPath);
          this.storage.removeMetadata(task);
          this.emitEvent(EVENTS.DOWNLOAD_COMPLETED, task.snapshot());
          resolve(TransferResult.ok('download.completed', task.snapshot()));
        } catch (error) {
          await writer.close();
          if (error.code === STATES.PAUSED) {
            task.setState(STATES.PAUSED);
            this.storage.writeMetadata(task);
            this.emitEvent(EVENTS.DOWNLOAD_PAUSED, task.snapshot());
            resolve(TransferResult.ok('download.paused', task.snapshot()));
            return;
          }
          if (error.code === STATES.CANCELLED || error.code === 'ABORT_ERR') {
            task.setState(STATES.CANCELLED);
            this.storage.writeMetadata(task);
            this.emitEvent(EVENTS.DOWNLOAD_CANCELLED, task.snapshot());
            resolve(TransferResult.ok('download.cancelled', task.snapshot()));
            return;
          }
          resolve(TransferResult.fail('download.failed', error, task.snapshot()));
        }
      });

      request.on('timeout', () => {
        const error = new Error('Download timed out.');
        error.code = 'TIMEOUT';
        request.destroy(error);
      });
      request.on('error', error => {
        if (responseStarted) return;
        if (task.state === STATES.PAUSED) {
          resolve(TransferResult.ok('download.paused', task.snapshot()));
          return;
        }
        if (task.state === STATES.CANCELLED || error.name === 'AbortError') {
          resolve(TransferResult.ok('download.cancelled', task.snapshot()));
          return;
        }
        resolve(TransferResult.fail('download.failed', error, task.snapshot()));
      });
      request.end();
    }).finally(() => {
      task.controller = null;
    });
  }
}

module.exports = DownloadWorker;
