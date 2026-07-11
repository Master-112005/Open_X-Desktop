class InstallationPolicy {
  constructor(configuration = {}) {
    this.configuration = configuration;
  }

  evaluate(status = {}) {
    if (this.configuration.enabled === false) return this.reject('INSTALLATION_DISABLED', 'Installation is disabled.');
    if (this.configuration.requireConfirmation === false) {
      return this.reject('CONFIRMATION_REQUIRED', 'Installation must require explicit confirmation.');
    }
    if (this.configuration.preventDuplicateInstallations !== false && status.running === true) {
      return this.reject('INSTALLATION_RUNNING', 'An installation is already running.');
    }
    return { allowed: true };
  }

  reject(code, message) {
    return { allowed: false, code, message };
  }
}

module.exports = InstallationPolicy;
