'use strict';

class Timer {
  constructor(options = {}) {
    this.setTimeoutImpl = options.setTimeout || setTimeout;
    this.clearTimeoutImpl = options.clearTimeout || clearTimeout;
    this.handle = null;
  }

  start(callback, delayMs) {
    this.clear();
    this.handle = this.setTimeoutImpl(() => {
      this.handle = null;
      callback?.();
    }, Math.max(0, Number(delayMs) || 0));
    if (typeof this.handle?.unref === 'function') this.handle.unref();
    return this.handle;
  }

  restart(callback, delayMs) {
    return this.start(callback, delayMs);
  }

  active() {
    return this.handle !== null;
  }

  wait(delayMs) {
    return new Promise(resolve => {
      this.start(resolve, delayMs);
    });
  }

  clear() {
    if (this.handle) this.clearTimeoutImpl(this.handle);
    this.handle = null;
    return this;
  }
}

module.exports = Timer;
