class RecoveryCoordinator {
  constructor(options = {}) {
    this.restoreHandlers = Array.isArray(options.restoreHandlers) ? options.restoreHandlers : [];
    this.restartManager = options.restartManager || null;
    this.restartOptions = options.restartOptions || {};
  }

  async restoreState(context = {}) {
    const startedAt = Date.now();
    const handlers = [];
    for (const handler of this.restoreHandlers) {
      if (typeof handler !== 'function') continue;
      const handlerStartedAt = Date.now();
      try {
        await handler(context);
        handlers.push({ success: true, durationMs: Date.now() - handlerStartedAt });
      } catch (error) {
        handlers.push({ success: false, error: error.message, durationMs: Date.now() - handlerStartedAt });
        throw error;
      }
    }
    return { success: true, durationMs: Date.now() - startedAt, handlers };
  }

  async restart(options = {}) {
    if (!this.restartManager?.restart) {
      return { success: true, skipped: true, durationMs: 0 };
    }
    return this.restartManager.restart({ ...this.restartOptions, ...(options || {}) });
  }
}

module.exports = RecoveryCoordinator;
