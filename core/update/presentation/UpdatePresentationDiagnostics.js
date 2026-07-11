class UpdatePresentationDiagnostics {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.reset();
  }

  reset() {
    this.uiOpenCount = 0;
    this.settingsVisits = 0;
    this.buttonUsage = {};
    this.assistantRequests = 0;
    this.voiceRequests = 0;
    this.dynamicIslandInteractions = 0;
    this.notificationCount = 0;
    this.dismissCount = 0;
    this.errors = [];
  }

  mark(name, key = '') {
    if (!this.enabled) return;
    if (name === 'buttonUsage' && key) {
      this.buttonUsage[key] = (this.buttonUsage[key] || 0) + 1;
      return;
    }
    if (typeof this[name] === 'number') this[name] += 1;
  }

  recordError(error) {
    if (!this.enabled) return;
    this.errors.unshift({
      at: new Date().toISOString(),
      code: error?.code || null,
      message: error?.message || String(error || 'Unknown error')
    });
    this.errors = this.errors.slice(0, 25);
  }

  snapshot(extra = {}) {
    return Object.freeze({
      enabled: this.enabled,
      uiOpenCount: this.uiOpenCount,
      settingsVisits: this.settingsVisits,
      buttonUsage: { ...this.buttonUsage },
      assistantRequests: this.assistantRequests,
      voiceRequests: this.voiceRequests,
      dynamicIslandInteractions: this.dynamicIslandInteractions,
      notificationCount: this.notificationCount,
      dismissCount: this.dismissCount,
      errors: this.errors.slice(),
      ...extra
    });
  }
}

module.exports = UpdatePresentationDiagnostics;
