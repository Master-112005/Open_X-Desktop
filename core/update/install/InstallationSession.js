class InstallationSession {
  constructor(input = {}) {
    const now = new Date().toISOString();
    this.sessionId = input.sessionId || `install_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    this.installerPath = input.installerPath || '';
    this.installerVersion = input.installerVersion || '';
    this.currentVersion = input.currentVersion || '';
    this.startTime = now;
    this.confirmationTime = null;
    this.launchTime = null;
    this.finishTime = null;
    this.exitCode = null;
    this.result = 'PENDING';
    this.errors = [];
  }

  confirm() {
    this.confirmationTime = new Date().toISOString();
  }

  launched() {
    this.launchTime = new Date().toISOString();
  }

  finish(result, exitCode = null) {
    this.finishTime = new Date().toISOString();
    this.result = result;
    this.exitCode = exitCode;
  }

  fail(error) {
    this.errors.push({ code: error?.code || null, message: String(error?.message || error) });
    this.finish('FAILED', this.exitCode);
  }

  snapshot() {
    const durationMs = this.finishTime ? Math.max(0, Date.parse(this.finishTime) - Date.parse(this.startTime)) : null;
    return Object.freeze({
      sessionId: this.sessionId,
      installerPath: this.installerPath,
      installerVersion: this.installerVersion,
      currentVersion: this.currentVersion,
      startTime: this.startTime,
      confirmationTime: this.confirmationTime,
      launchTime: this.launchTime,
      finishTime: this.finishTime,
      durationMs,
      exitCode: this.exitCode,
      result: this.result,
      errors: this.errors.slice()
    });
  }
}

module.exports = InstallationSession;
