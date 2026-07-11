class ApplicationRestorer {
  constructor(options = {}) {
    this.handlers = Array.isArray(options.handlers) ? options.handlers : [];
  }

  async restore(context = {}) {
    const startedAt = Date.now();
    const results = [];
    for (const handler of this.handlers) {
      if (typeof handler !== 'function') continue;
      const handlerStartedAt = Date.now();
      try {
        await handler(context);
        results.push({ success: true, durationMs: Date.now() - handlerStartedAt });
      } catch (error) {
        results.push({ success: false, error: error.message, durationMs: Date.now() - handlerStartedAt });
      }
    }
    return {
      success: results.every(result => result.success !== false),
      durationMs: Date.now() - startedAt,
      handlers: results
    };
  }
}

module.exports = ApplicationRestorer;
