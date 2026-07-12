class StartupValidator {
  constructor(options = {}) {
    this.configuration = options.configuration;
  }

  validate(input = {}) {
    if (this.configuration?.startupValidationEnabled === false) {
      return { success: true, skipped: true, errors: [], warnings: [] };
    }
    const errors = [];
    this._expect(input.applicationStarted !== false, 'Application did not report successful startup.', errors);
    this._expect(input.servicesInitialized !== false, 'Required services were not initialized.', errors);
    this._expect(input.coreModulesInitialized !== false, 'Core modules were not initialized.', errors);
    this._expect(input.assistantInitialized !== false, 'Assistant did not initialize.', errors);
    this._expect(input.ipcInitialized !== false, 'IPC handlers were not initialized.', errors);
    this._expect(input.configurationLoaded !== false, 'Configuration failed to load.', errors);
    this._expect(input.mainWindowCreated !== false, 'Main window was not created.', errors);
    const fatal = Array.isArray(input.fatalStartupErrors) ? input.fatalStartupErrors : [];
    if (fatal.length > 0) errors.push(`Fatal startup errors detected: ${fatal.map(item => item.message || item).join('; ')}`);
    const duration = Number(input.startupDurationMs ?? 0);
    const limit = Number(this.configuration?.startupTimeoutMs || 120000);
    if (duration > limit) errors.push(`Startup validation timeout exceeded (${duration}ms > ${limit}ms).`);
    return {
      success: errors.length === 0,
      skipped: false,
      errors,
      warnings: [],
      durationMs: duration,
      timeoutMs: limit,
      checkedAt: new Date().toISOString()
    };
  }

  _expect(condition, message, errors) {
    if (!condition) errors.push(message);
  }
}

module.exports = StartupValidator;
