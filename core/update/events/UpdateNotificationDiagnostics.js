class UpdateNotificationDiagnostics {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.reset();
  }

  reset() {
    this.received = 0;
    this.validated = 0;
    this.displayed = 0;
    this.ignored = 0;
    this.dismissCount = 0;
    this.acknowledgementsSent = 0;
    this.errors = [];
    this.lastEventAt = null;
    this.lastNotificationAt = null;
    this.lastDisplayedAt = null;
    this.lastErrorAt = null;
  }

  mark(field) {
    if (!this.enabled) return;
    if (typeof this[field] === 'number') this[field] += 1;
    this.lastEventAt = new Date().toISOString();
  }

  recordError(error) {
    if (!this.enabled) return;
    this.lastErrorAt = new Date().toISOString();
    this.errors.unshift({
      at: this.lastErrorAt,
      message: error?.message || String(error || 'Unknown error'),
      code: error?.code || null
    });
    this.errors = this.errors.slice(0, 25);
  }

  snapshot(extra = {}) {
    return Object.freeze({
      enabled: this.enabled,
      received: this.received,
      validated: this.validated,
      displayed: this.displayed,
      ignored: this.ignored,
      dismissCount: this.dismissCount,
      acknowledgementsSent: this.acknowledgementsSent,
      lastEventAt: this.lastEventAt,
      lastNotificationAt: this.lastNotificationAt,
      lastDisplayedAt: this.lastDisplayedAt,
      lastErrorAt: this.lastErrorAt,
      errors: this.errors.slice(),
      ...extra
    });
  }
}

module.exports = UpdateNotificationDiagnostics;
