'use strict';

class RuntimeManager {
  constructor({ configuration, diagnostics = null, logger = null } = {}) {
    this.configuration = configuration;
    this.diagnostics = diagnostics;
    this.logger = logger;
    this.adapters = new Map();
    this.sessions = new Map();
    this.loggedAdapters = new Set();
    this.loggedSessions = new Set();
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
    this.diagnostics?.record?.('runtime-initialized', this.getStatus());
    return this;
  }

  registerAdapter(runtimeId, adapter) {
    if (!runtimeId || !adapter) throw new Error('Runtime adapter id and adapter are required');
    const id = String(runtimeId);
    this.adapters.set(id, adapter);
    if (!this.loggedAdapters.has(id)) {
      this.loggedAdapters.add(id);
      this.logger?.info?.('[Vision Models] Vision runtime adapter registered', {
        runtime: id,
        adapter: adapter?.constructor?.name || 'custom-adapter'
      });
    }
    return this;
  }

  async createSession(model) {
    if (!this.initialized) await this.initialize();
    const key = model.id;
    if (this.sessions.has(key)) return this.sessions.get(key);
    const adapter = this.adapters.get(model.runtime);
    if (!adapter || typeof adapter.createSession !== 'function') {
      const error = new Error(`Runtime adapter is not available for ${model.runtime}`);
      error.code = 'vision.runtime_unavailable';
      throw error;
    }
    const session = await adapter.createSession(model, this.configuration.runtime);
    this.sessions.set(key, session);
    if (!this.loggedSessions.has(key)) {
      this.loggedSessions.add(key);
      this.logger?.debug?.('[Vision Models] Runtime session ready', {
        modelId: model.id,
        model: model.name || model.id,
        runtime: model.runtime
      });
    }
    this.diagnostics?.record?.('runtime-session-created', { modelId: model.id, runtime: model.runtime });
    return session;
  }

  async runSession(model, input, options = {}) {
    const session = await this.createSession(model);
    if (typeof session.run !== 'function') {
      const error = new Error(`Runtime session for ${model.id} cannot run inference`);
      error.code = 'vision.session_invalid';
      throw error;
    }
    return session.run(input, options);
  }

  async disposeSession(modelId) {
    const id = String(modelId || '');
    const session = this.sessions.get(id);
    if (session?.dispose) await session.dispose();
    this.sessions.delete(id);
  }

  async shutdown() {
    for (const modelId of Array.from(this.sessions.keys())) {
      await this.disposeSession(modelId);
    }
    this.initialized = false;
    this.diagnostics?.record?.('runtime-shutdown');
  }

  getStatus() {
    return {
      initialized: this.initialized,
      adapters: Array.from(this.adapters.keys()),
      sessionCount: this.sessions.size,
      runtime: this.configuration?.runtime || {}
    };
  }
}

module.exports = RuntimeManager;
