class ShutdownCoordinator {
  constructor(options = {}) {
    this.applicationStateManager = options.applicationStateManager || null;
    this.shutdownHandlers = Array.isArray(options.shutdownHandlers) ? options.shutdownHandlers : [];
  }

  async prepare(context = {}) {
    const startedAt = Date.now();
    const savedState = await this.applicationStateManager?.save?.(context);
    const shutdownResults = [];
    for (const handler of this.shutdownHandlers) {
      if (typeof handler !== 'function') continue;
      const handlerStartedAt = Date.now();
      await handler(context);
      shutdownResults.push({ success: true, durationMs: Date.now() - handlerStartedAt });
    }
    return {
      success: true,
      savedState: savedState || [],
      shutdownResults,
      durationMs: Date.now() - startedAt
    };
  }
}

module.exports = ShutdownCoordinator;
