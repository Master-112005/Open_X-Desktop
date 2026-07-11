class ApplicationStateManager {
  constructor(options = {}) {
    this.saveHandlers = Array.isArray(options.saveHandlers) ? options.saveHandlers : [];
  }

  async save(context = {}) {
    const results = [];
    for (const handler of this.saveHandlers) {
      if (typeof handler !== 'function') continue;
      const startedAt = Date.now();
      try {
        await handler(context);
        results.push({ success: true, durationMs: Date.now() - startedAt });
      } catch (error) {
        results.push({ success: false, error: error.message, durationMs: Date.now() - startedAt });
        throw error;
      }
    }
    return results;
  }
}

module.exports = ApplicationStateManager;
