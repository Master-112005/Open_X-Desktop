'use strict';

class Stopwatch {
  constructor(clock = null) {
    this.clock = clock || (() => {
      if (typeof process !== 'undefined' && process.hrtime?.bigint) {
        return Number(process.hrtime.bigint()) / 1000000;
      }
      return Date.now();
    });
    this.startedAt = 0;
    this.stoppedAt = 0;
    this.running = false;
    this.laps = [];
  }

  start() {
    this.startedAt = this.clock();
    this.stoppedAt = 0;
    this.running = true;
    this.laps = [];
    return this;
  }

  stop() {
    if (this.running) {
      this.stoppedAt = this.clock();
      this.running = false;
    }
    return this.elapsedMs();
  }

  elapsedMs() {
    if (!this.startedAt) return 0;
    const end = this.running ? this.clock() : this.stoppedAt;
    return Math.max(0, Math.round((end - this.startedAt) * 1000) / 1000);
  }

  lap(label = '') {
    const entry = {
      label: String(label || ''),
      elapsedMs: this.elapsedMs(),
      timestamp: Date.now()
    };
    this.laps.push(entry);
    return entry;
  }

  reset() {
    this.startedAt = 0;
    this.stoppedAt = 0;
    this.running = false;
    this.laps = [];
    return this;
  }

  snapshot() {
    return {
      running: this.running,
      elapsedMs: this.elapsedMs(),
      laps: this.laps.slice()
    };
  }
}

module.exports = Stopwatch;
