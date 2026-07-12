const ProcessMonitor = require('./ProcessMonitor');

class InstallationMonitor {
  constructor(options = {}) {
    this.monitor = options.monitor || new ProcessMonitor({ timeoutMs: options.timeoutMs });
  }

  waitForInstaller(child, options = {}) {
    return this.monitor.monitor(child, options);
  }
}

module.exports = InstallationMonitor;
