class VerificationSession {
  constructor(filePath) {
    this.verificationId = `verify_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    this.installer = filePath;
    this.startTime = new Date().toISOString();
    this.finishTime = null;
    this.checksCompleted = [];
    this.checksFailed = [];
  }

  complete(result) {
    this.finishTime = new Date().toISOString();
    for (const check of result.checks || []) {
      if (check.success) this.checksCompleted.push(check.name);
      else this.checksFailed.push(check.name);
    }
  }

  snapshot(result = null) {
    return Object.freeze({
      verificationId: this.verificationId,
      installer: this.installer,
      startTime: this.startTime,
      finishTime: this.finishTime,
      durationMs: this.finishTime ? Date.parse(this.finishTime) - Date.parse(this.startTime) : null,
      checksCompleted: this.checksCompleted.slice(),
      checksFailed: this.checksFailed.slice(),
      verificationResult: result ? {
        success: result.success,
        status: result.status,
        securityLevel: result.securityLevel,
        errors: result.errors
      } : null
    });
  }
}

module.exports = VerificationSession;
