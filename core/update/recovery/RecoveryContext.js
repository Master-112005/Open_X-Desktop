class RecoveryContext {
  constructor(input = {}) {
    this.initialized = input.initialized === true;
    this.running = input.running === true;
    this.directories = input.directories || {};
    this.currentSession = input.currentSession || null;
    this.latestBackup = input.latestBackup || null;
    this.lastResult = input.lastResult || null;
  }

  update(patch = {}) {
    return new RecoveryContext({ ...this, ...(patch || {}) });
  }

  snapshot() {
    return {
      initialized: this.initialized,
      running: this.running,
      directories: this.directories,
      currentSession: this.currentSession?.snapshot?.() || this.currentSession || null,
      latestBackup: this.latestBackup,
      lastResult: this.lastResult
    };
  }
}

module.exports = RecoveryContext;
