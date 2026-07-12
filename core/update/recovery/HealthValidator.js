class HealthValidator {
  constructor(options = {}) {
    this.configuration = options.configuration;
  }

  validate(input = {}) {
    const errors = [];
    if (input.responsive === false) errors.push('Application did not report responsiveness.');
    if (input.criticalModulesLoaded === false) errors.push('Critical modules did not load.');
    if (input.initializationCompleted === false) errors.push('Initialization did not complete.');
    if (input.mainWindowCreated === false) errors.push('Main window health check failed.');
    const fatal = Array.isArray(input.fatalExceptions) ? input.fatalExceptions : [];
    if (fatal.length > 0) errors.push(`Fatal runtime exceptions detected: ${fatal.map(item => item.message || item).join('; ')}`);
    const duration = Number(input.healthDurationMs ?? 0);
    const limit = Number(this.configuration?.healthTimeoutMs || 30000);
    if (duration > limit) errors.push(`Health validation timeout exceeded (${duration}ms > ${limit}ms).`);
    return {
      success: errors.length === 0,
      errors,
      durationMs: duration,
      timeoutMs: limit,
      checkedAt: new Date().toISOString()
    };
  }
}

module.exports = HealthValidator;
