class VerificationDiagnostics {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.reset();
  }

  reset() {
    this.verificationCount = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.totalVerificationTimeMs = 0;
    this.shaCalculationTimeMs = 0;
    this.signatureValidationTimeMs = 0;
    this.policyFailures = 0;
    this.lastVerifiedInstaller = null;
    this.lastSuccessfulVerification = null;
    this.lastFailedVerification = null;
    this.errors = [];
  }

  started() {
    if (!this.enabled) return;
    this.verificationCount += 1;
  }

  completed(result) {
    if (!this.enabled) return;
    this.totalVerificationTimeMs += Number(result.durationMs || 0);
    if (result.success) {
      this.successCount += 1;
      this.lastSuccessfulVerification = result.timestamp;
    } else {
      this.failureCount += 1;
      this.lastFailedVerification = result.timestamp;
      for (const error of result.errors || []) {
        if (String(error.code || '').includes('POLICY')) this.policyFailures += 1;
      }
    }
    this.lastVerifiedInstaller = result.data?.filePath || null;
  }

  addTiming(name, durationMs) {
    if (!this.enabled) return;
    if (name === 'sha256') this.shaCalculationTimeMs += Math.max(0, Number(durationMs) || 0);
    if (name === 'signature') this.signatureValidationTimeMs += Math.max(0, Number(durationMs) || 0);
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
    const successRate = this.verificationCount ? this.successCount / this.verificationCount : 0;
    const failureRate = this.verificationCount ? this.failureCount / this.verificationCount : 0;
    return Object.freeze({
      enabled: this.enabled,
      verificationCount: this.verificationCount,
      successCount: this.successCount,
      failureCount: this.failureCount,
      successRate,
      failureRate,
      averageVerificationTimeMs: this.verificationCount ? Math.round(this.totalVerificationTimeMs / this.verificationCount) : 0,
      shaCalculationTimeMs: this.shaCalculationTimeMs,
      signatureValidationTimeMs: this.signatureValidationTimeMs,
      policyFailures: this.policyFailures,
      lastVerifiedInstaller: this.lastVerifiedInstaller,
      lastSuccessfulVerification: this.lastSuccessfulVerification,
      lastFailedVerification: this.lastFailedVerification,
      errors: this.errors.slice(),
      ...extra
    });
  }
}

module.exports = VerificationDiagnostics;
