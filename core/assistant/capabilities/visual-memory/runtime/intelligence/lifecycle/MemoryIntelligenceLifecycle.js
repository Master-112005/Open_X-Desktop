'use strict';

class MemoryIntelligenceLifecycle {
  constructor({ events = null, diagnostics = null } = {}) {
    this.events = events;
    this.diagnostics = diagnostics;
    this.state = 'created';
  }

  transition(state, payload = {}) {
    this.state = state;
    this.diagnostics?.record?.('lifecycle-transition', { state, ...payload });
    this.events?.emit?.(`visual-memory.intelligence.${state}`, payload);
    return this.getState();
  }

  getState() {
    return { state: this.state, ready: ['ready', 'searching'].includes(this.state) };
  }
}

module.exports = MemoryIntelligenceLifecycle;
