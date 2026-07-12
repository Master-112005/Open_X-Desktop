class SizeVerifier {
  constructor(options = {}) {
    this.configuration = options.configuration;
  }

  verify(context) {
    const startedAt = Date.now();
    try {
      const actual = Number(context.file?.size || 0);
      if (actual < this.configuration.minimumBytes) throw this.error('SIZE_TOO_SMALL', 'Downloaded package is smaller than allowed.');
      if (actual > this.configuration.maximumBytes) throw this.error('SIZE_TOO_LARGE', 'Downloaded package is larger than allowed.');
      const expected = Number(context.manifest.size || context.manifest.fileSize || context.manifest.bytes || 0);
      if (expected > 0 && actual !== expected) {
        throw this.error('SIZE_MISMATCH', `Downloaded size ${actual} does not match manifest size ${expected}.`);
      }
      return context.addCheck('size', true, { actual, expected: expected || null }, null, Date.now() - startedAt);
    } catch (error) {
      return context.addCheck('size', false, {}, error, Date.now() - startedAt);
    }
  }

  error(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }
}

module.exports = SizeVerifier;
