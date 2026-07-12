class InstallationContext {
  constructor(input = {}) {
    this.initialized = input.initialized === true;
    this.running = input.running === true;
    this.directories = input.directories || {};
    this.currentVersion = input.currentVersion || '';
    this.latestVerification = input.latestVerification || null;
  }

  update(patch = {}) {
    return new InstallationContext({ ...this, ...patch });
  }
}

module.exports = InstallationContext;
