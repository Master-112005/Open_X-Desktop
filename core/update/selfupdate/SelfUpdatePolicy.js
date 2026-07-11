class SelfUpdatePolicy {
  constructor(configuration = {}) {
    this.configuration = configuration;
  }

  evaluate(status = {}) {
    if (this.configuration.enabled === false) return this.reject('SELF_UPDATE_DISABLED', 'Self update is disabled.');
    if (this.configuration.silentInstallationEnabled === false) {
      return this.reject('SILENT_INSTALLATION_DISABLED', 'Silent installation is disabled.');
    }
    if (status.running === true) return this.reject('SELF_UPDATE_RUNNING', 'A self update is already running.');
    if (this.configuration.restartAfterInstall === false) {
      return this.reject('RESTART_DISABLED', 'Restart after installation is disabled.');
    }
    return { allowed: true };
  }

  reject(code, message) {
    return { allowed: false, code, message };
  }
}

module.exports = SelfUpdatePolicy;
