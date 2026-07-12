class SelfUpdateSession {
  constructor(input = {}) {
    const now = new Date().toISOString();
    this.sessionId = input.sessionId || `self_update_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    this.currentVersion = input.currentVersion || '';
    this.targetVersion = input.targetVersion || input.installerVersion || '';
    this.installerVersion = input.installerVersion || input.targetVersion || '';
    this.installerPath = input.installerPath || '';
    this.startTime = now;
    this.shutdownTime = null;
    this.installTime = null;
    this.restartTime = null;
    this.completionTime = null;
    this.exitCode = null;
    this.durationMs = null;
    this.result = 'PENDING';
    this.errors = [];
  }

  markShutdown() {
    this.shutdownTime = new Date().toISOString();
  }

  markInstallStarted() {
    this.installTime = new Date().toISOString();
  }

  markRestart() {
    this.restartTime = new Date().toISOString();
  }

  finish(result, exitCode = null) {
    this.completionTime = new Date().toISOString();
    this.result = result;
    this.exitCode = exitCode;
    this.durationMs = Math.max(0, Date.parse(this.completionTime) - Date.parse(this.startTime));
  }

  fail(error) {
    this.errors.push({ code: error?.code || null, message: String(error?.message || error) });
    this.finish('FAILED', this.exitCode);
  }

  snapshot() {
    return Object.freeze({
      sessionId: this.sessionId,
      currentVersion: this.currentVersion,
      targetVersion: this.targetVersion,
      installerVersion: this.installerVersion,
      installerPath: this.installerPath,
      startTime: this.startTime,
      shutdownTime: this.shutdownTime,
      installTime: this.installTime,
      restartTime: this.restartTime,
      completionTime: this.completionTime,
      exitCode: this.exitCode,
      durationMs: this.durationMs,
      result: this.result,
      errors: this.errors.slice()
    });
  }
}

module.exports = SelfUpdateSession;
