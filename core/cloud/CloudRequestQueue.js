class CloudRequestQueue {
  constructor(options = {}) {
    this.maxQueueSize = Number.isFinite(options.maxQueueSize)
      ? Math.max(1, Math.round(options.maxQueueSize))
      : 25;
    this.mode = options.mode === 'busy' ? 'busy' : 'queue';
    this.items = [];
    this.active = false;
    this.completed = 0;
    this.failed = 0;
    this.rejected = 0;
  }

  enqueue(item) {
    if (this.mode === 'busy' && (this.active || this.items.length > 0)) {
      this.rejected += 1;
      return { accepted: false, code: 'assistant-busy', message: 'Assistant Busy' };
    }
    if (this.items.length >= this.maxQueueSize) {
      this.rejected += 1;
      return { accepted: false, code: 'queue-full', message: 'Request Queue Full' };
    }
    this.items.push({
      ...item,
      state: 'queued',
      queuedAt: Date.now()
    });
    return { accepted: true };
  }

  next() {
    const item = this.items.shift() || null;
    if (item) {
      this.active = true;
      item.state = 'executing';
      item.startedAt = Date.now();
    }
    return item;
  }

  finish(success) {
    this.active = false;
    if (success) this.completed += 1;
    else this.failed += 1;
  }

  clear() {
    const queued = this.items.length;
    this.items = [];
    this.active = false;
    return queued;
  }

  getStatistics() {
    return {
      mode: this.mode,
      maxQueueSize: this.maxQueueSize,
      queued: this.items.length,
      active: this.active,
      completed: this.completed,
      failed: this.failed,
      rejected: this.rejected
    };
  }
}

module.exports = CloudRequestQueue;
