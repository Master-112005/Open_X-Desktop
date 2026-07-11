const fs = require('fs');
const path = require('path');

class StatePreserver {
  constructor(options = {}) {
    this.handlers = Array.isArray(options.handlers) ? options.handlers : [];
    this.statePath = options.statePath || '';
  }

  async preserve(context = {}) {
    const startedAt = Date.now();
    const handlerResults = [];
    for (const handler of this.handlers) {
      if (typeof handler !== 'function') continue;
      const handlerStartedAt = Date.now();
      try {
        const data = await handler(context);
        handlerResults.push({ success: true, durationMs: Date.now() - handlerStartedAt, data: data || null });
      } catch (error) {
        handlerResults.push({ success: false, durationMs: Date.now() - handlerStartedAt, error: error.message });
        throw error;
      }
    }
    const snapshot = {
      savedAt: new Date().toISOString(),
      sessionId: context.session?.sessionId || '',
      currentVersion: context.session?.currentVersion || '',
      targetVersion: context.session?.targetVersion || '',
      handlers: handlerResults
    };
    if (this.statePath) {
      fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
      fs.writeFileSync(this.statePath, JSON.stringify(snapshot, null, 2));
    }
    return {
      success: true,
      durationMs: Date.now() - startedAt,
      statePath: this.statePath,
      handlers: handlerResults
    };
  }
}

module.exports = StatePreserver;
