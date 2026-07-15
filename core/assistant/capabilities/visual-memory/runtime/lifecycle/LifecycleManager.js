'use strict';

class LifecycleManager {
  constructor({ events, diagnostics } = {}) {
    this.events = events;
    this.diagnostics = diagnostics;
    this.state = 'created';
  }

  transition(nextState, payload = {}) {
    this.state = nextState;
    this.diagnostics?.setStatus?.(nextState);
    this.events?.emit?.(`visual-memory.${nextState}`, payload);
    return this.getState();
  }

  getState() {
    return { state: this.state, ready: this.state === 'ready' || this.state === 'started' };
  }
}

module.exports = LifecycleManager;
