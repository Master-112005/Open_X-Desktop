class RecoveryPolicy {
  constructor(configuration) {
    this.configuration = configuration;
  }

  evaluate(input = {}) {
    if (!this.configuration?.enabled) {
      return { allowed: false, code: 'RECOVERY_DISABLED', message: 'Update recovery is disabled.' };
    }
    if (!this.configuration?.automaticRollback) {
      return { allowed: false, code: 'AUTOMATIC_ROLLBACK_DISABLED', message: 'Automatic rollback is disabled.' };
    }
    if (input.running === true) {
      return { allowed: false, code: 'RECOVERY_ALREADY_RUNNING', message: 'Recovery is already running.' };
    }
    if (!input.backup) {
      return { allowed: false, code: 'BACKUP_UNAVAILABLE', message: 'No trusted recovery backup is available.' };
    }
    const attempts = Number(input.attempts || 0);
    const max = Number(this.configuration?.maxRecoveryAttempts || 1);
    if (attempts >= max) {
      return { allowed: false, code: 'RECOVERY_ATTEMPTS_EXHAUSTED', message: 'Recovery attempt limit reached.' };
    }
    return { allowed: true, code: 'RECOVERY_ALLOWED', message: 'Recovery is allowed.' };
  }
}

module.exports = RecoveryPolicy;
